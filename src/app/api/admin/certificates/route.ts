import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminRequestContext } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/api-security";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function failure(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const context = await getAdminRequestContext();
  if (!context.ok) return failure(context.error, context.status);
  const db = createSupabaseAdminClient();
  if (!db) return failure("Database services are not configured.", 503);
  const [students, certificates] = await Promise.all([
    db.from("profiles").select("id,full_name,email").eq("role", "student").is("suspended_at", null).order("full_name").limit(500),
    db.from("certificates").select("id,student_id,title,programme_name,created_at,profiles!certificates_student_id_fkey(full_name,email)").order("created_at", { ascending: false }).limit(500),
  ]);
  if (students.error || certificates.error) return failure("Could not load certificate records.", 500);
  return NextResponse.json({ students: students.data ?? [], data: certificates.data ?? [] });
}

export async function POST(request: NextRequest) {
  const context = await getAdminRequestContext();
  if (!context.ok) return failure(context.error, context.status);
  const db = createSupabaseAdminClient();
  if (!db) return failure("Database services are not configured.", 503);
  const form = await request.formData();
  const studentId = form.get("student_id");
  const title = form.get("title");
  const programmeName = form.get("programme_name");
  const file = form.get("certificate");
  if (typeof studentId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(studentId)) return failure("Choose a valid student.");
  if (typeof title !== "string" || !title.trim() || title.trim().length > 160) return failure("Enter a certificate title.");
  if (typeof programmeName !== "string" || programmeName.length > 160) return failure("Programme name is too long.");
  if (!(file instanceof File)) return failure("Choose a PDF certificate.");
  if (file.type !== "application/pdf") return failure("Certificate must be a PDF.", 415);
  if (file.size < 8 || file.size > 10 * 1024 * 1024) return failure("Certificate PDF must be no larger than 10 MB.", 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") return failure("The certificate file is not a valid PDF.", 415);
  const { data: student, error: studentError } = await db.from("profiles").select("id,role,full_name").eq("id", studentId).eq("role", "student").maybeSingle();
  if (studentError) return failure("Could not verify the selected student.", 500);
  if (!student) return failure("Student was not found.", 404);

  const path = `${studentId}/${randomUUID()}.pdf`;
  const { error: uploadError } = await db.storage.from("student-certificates").upload(path, bytes, {
    contentType: "application/pdf", cacheControl: "0", upsert: false,
  });
  if (uploadError) {
    console.error("Could not upload student certificate:", uploadError.message);
    return failure("Could not upload the certificate.", 500);
  }
  const { data, error } = await db.from("certificates").insert({
    student_id: studentId,
    title: title.trim(),
    programme_name: programmeName.trim(),
    storage_path: path,
    created_by: context.user.id,
  }).select("id,student_id,title,programme_name,created_at").single();
  if (error) {
    const { error: cleanupError } = await db.storage.from("student-certificates").remove([path]);
    if (cleanupError) console.error("Could not clean up an unlinked certificate file:", cleanupError.message);
    console.error("Could not save certificate record:", error.message);
    return failure("The PDF uploaded, but its certificate record could not be saved.", 500);
  }

  const warnings: string[] = [];
  const { error: notificationError } = await db.from("notifications").insert({
    student_id: studentId,
    title: "New certificate available",
    body: `Tamark issued you a certificate${programmeName.trim() ? ` for ${programmeName.trim()}` : ""}. Sign in to your portal to download it.`,
  });
  if (notificationError) {
    console.error("Certificate was issued but the student notification could not be saved:", notificationError.message);
    warnings.push("Certificate issued, but the student notification could not be saved.");
  }
  try {
    await writeAuditLog({
      actorId: context.user.id,
      eventType: "certificate.issued",
      relatedRecordId: data.id,
      metadata: { student_id: studentId, title: title.trim() },
    });
  } catch (reason) {
    console.error("Certificate was issued but its audit event could not be recorded:", reason);
    warnings.push("Certificate issued, but the audit event could not be recorded.");
  }
  return NextResponse.json({ data, warnings }, { status: 201 });
}
