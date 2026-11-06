import { NextResponse, type NextRequest } from "next/server";
import { getAdminRequestContext } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendPushToStudent } from "@/lib/push-notifications";
import { writeAuditLog } from "@/lib/api-security";

type RouteContext = { params: Promise<{ path: string[] }> };
type Data = Record<string, unknown>;

async function parseBody(request: NextRequest): Promise<Data | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null && !Array.isArray(body) ? body as Data : null;
  } catch {
    return null;
  }
}

function text(value: unknown, max = 5000) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max ? value.trim() : null;
}

function validProgrammeImagePath(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i.test(value);
}

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const context = await getAdminRequestContext();
  if (!context.ok) return fail(context.error, context.status);
  const db = createSupabaseAdminClient();
  if (!db) return fail("Database services are not configured.", 503);
  const { path } = await params;
  const resource = path[0];
  if (!resource) return fail("Dashboard resource is required.", 404);
  if (resource === "dashboard") {
    const [applications, students, pending, revenue, recent] = await Promise.all([
      db.from("applications").select("id,status", { count: "exact", head: true }),
      db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
      db.from("applications").select("id", { count: "exact", head: true }).in("status", ["submitted", "under_review"]),
      db.rpc("admin_payment_summary"),
      db.from("applications").select("id,status,created_at,personal_details,programmes(name)").order("created_at", { ascending: false }).limit(8),
    ]);
    const error = applications.error ?? students.error ?? pending.error ?? revenue.error ?? recent.error;
    if (error) return fail("Could not load dashboard records.", 500);
    const revenueByCurrency: Record<string, number> = {};
    let verifiedPayments = 0;
    for (const row of revenue.data ?? []) {
      revenueByCurrency[row.currency] = Number(row.revenue_minor);
      verifiedPayments += Number(row.payment_count);
    }
    return NextResponse.json({
      stats: {
        applications: applications.count ?? 0,
        students: students.count ?? 0,
        pending: pending.count ?? 0,
        verifiedPayments,
        revenueByCurrency,
      },
      recent: recent.data ?? [],
    });
  }
  if (resource === "reports") {
    const [applicationSummary, payments, students] = await Promise.all([
      db.rpc("admin_application_summary"),
      db.rpc("admin_payment_summary"),
      db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
    ]);
    if (applicationSummary.error || payments.error || students.error) return fail("Could not generate the current report.", 500);
    const csvRows = [
      ["Section", "Status or currency", "Count", "Value"],
      ...(applicationSummary.data ?? []).map((row: { status: string; application_count: number }) => ["Applications", row.status, String(row.application_count), ""]),
      ...(payments.data ?? []).map((row: { currency: string; payment_count: number; revenue_minor: number }) => ["Verified payments", row.currency, String(row.payment_count), (Number(row.revenue_minor) / 100).toFixed(2)]),
      ["Students", "Total", String(students.count ?? 0), ""],
    ];
    const csv = csvRows.map((row: string[]) => row.map((field: string) => `"${field.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="tamark-current-report.csv"', "Cache-Control": "private, no-store" } });
  }
  if (resource === "programmes") {
    const { data, error } = await db.from("programmes").select("*").order("created_at", { ascending: false });
    if (error) return fail("Could not load programmes.", 500);
    return NextResponse.json({ data });
  }
  if (resource === "applications") {
    const { data, error } = await db.from("applications").select("id,status,created_at,updated_at,submitted_at,personal_details,contact_details,education_details,profiles!applications_student_id_fkey(id,full_name,email,phone),programmes(name,slug)").order("created_at", { ascending: false }).limit(500);
    if (error) return fail("Could not load applications.", 500);
    return NextResponse.json({ data });
  }
  if (resource === "students") {
    const { data, error } = await db.from("profiles").select("id,full_name,email,phone,role,created_at,applications(count)").order("created_at", { ascending: false }).eq("role", "student").limit(500);
    if (error) return fail("Could not load students.", 500);
    return NextResponse.json({ data });
  }
  if (resource === "payments") {
    const { data, error } = await db.from("payments").select("id,student_id,application_id,provider_reference,amount_minor,currency,status,verified_at,created_at,profiles!payments_student_id_fkey(full_name),applications(programmes(name))").order("created_at", { ascending: false }).limit(500);
    if (error) return fail("Could not load payments.", 500);
    return NextResponse.json({ data });
  }
  if (resource === "announcements") {
    const { data, error } = await db.from("announcements").select("*").order("created_at", { ascending: false });
    if (error) return fail("Could not load announcements.", 500);
    return NextResponse.json({ data });
  }
  if (resource === "schedule") {
    const { data, error } = await db.from("training_sessions").select("*,programmes(name)").order("starts_at");
    if (error) return fail("Could not load training schedule.", 500);
    return NextResponse.json({ data });
  }
  if (resource === "settings") {
    const { data, error } = await db.from("organization_settings").select("*").eq("id", true).maybeSingle();
    if (error) return fail("Could not load organization settings.", 500);
    return NextResponse.json({ data });
  }
  return fail("Unknown dashboard resource.", 404);
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getAdminRequestContext();
  if (!context.ok) return fail(context.error, context.status);
  const db = createSupabaseAdminClient();
  if (!db) return fail("Database services are not configured.", 503);
  const { path } = await params;
  const resource = path[0];
  if (!resource) return fail("Dashboard resource is required.", 404);
  const body = await parseBody(request);
  if (!body) return fail("Request body must be valid JSON.");

  if (resource === "programmes") {
    const name = text(body.name, 160);
    const summary = typeof body.summary === "string" && body.summary.length <= 2000 ? body.summary.trim() : null;
    const category = text(body.category, 80);
    const slug = text(body.slug, 180);
    const price = body.price_minor === "" || body.price_minor === null ? null : Number(body.price_minor);
    if (!name || summary === null || !category || !slug || (price !== null && (!Number.isSafeInteger(price) || price < 0))) return fail("Enter a valid programme name, slug, category, summary, and fee.");
    if (body.currency != null && body.currency !== "NGN") return fail("Only NGN payments are supported.");
    if (body.image_path != null && !validProgrammeImagePath(body.image_path)) return fail("Choose a valid uploaded programme image.");
    const { data, error } = await db.from("programmes").insert({
      name, summary, category, slug, duration: text(body.duration, 80), price_minor: price,
      currency: text(body.currency, 3) || "NGN", price_approved: body.price_approved === true,
      is_published: body.is_published === true && body.price_approved === true && price !== null,
      is_listed: body.is_published === true || body.is_listed !== false,
      image_path: body.image_path ?? null,
      entry_requirements: text(body.entry_requirements, 1000),
      curriculum: Array.isArray(body.curriculum) ? body.curriculum.filter((item): item is string => typeof item === "string").slice(0, 50) : [],
      outcomes: Array.isArray(body.outcomes) ? body.outcomes.filter((item): item is string => typeof item === "string").slice(0, 50) : [],
      updated_at: new Date().toISOString(),
    }).select("*").single();
    if (error) return fail(error.code === "23505" ? "A programme already uses this slug." : "Could not create programme.", 400);
    await writeAuditLog({ actorId: context.user.id, eventType: "programme.created", relatedRecordId: data.id, metadata: { price_configured: price !== null } });
    return NextResponse.json({ data }, { status: 201 });
  }
  if (resource === "announcements") {
    const title = text(body.title, 180);
    const message = text(body.body, 5000);
    if (!title || !message) return fail("Enter an announcement title and message.");
    const published = body.published === true;
    const { data, error } = await db.from("announcements").insert({
      title, body: message, published, published_at: published ? new Date().toISOString() : null, created_by: context.user.id,
    }).select("*").single();
    if (error) return fail("Could not create announcement.", 500);
    return NextResponse.json({ data }, { status: 201 });
  }
  if (resource === "schedule") {
    const title = text(body.title, 180);
    const startsAt = text(body.starts_at, 80);
    const endsAt = body.ends_at ? text(body.ends_at, 80) : null;
    if (!title || !startsAt || !Number.isFinite(Date.parse(startsAt)) || (body.ends_at && (!endsAt || !Number.isFinite(Date.parse(endsAt))))) return fail("Enter a valid session title and date.");
    const { data, error } = await db.from("training_sessions").insert({
      title, starts_at: startsAt, ends_at: endsAt, programme_id: text(body.programme_id, 80),
      location: text(body.location, 300), details: typeof body.details === "string" ? body.details.slice(0, 2000) : "",
    }).select("*").single();
    if (error) return fail("Could not create training session.", 500);
    return NextResponse.json({ data }, { status: 201 });
  }
  return fail("This resource does not support creation.", 404);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getAdminRequestContext();
  if (!context.ok) return fail(context.error, context.status);
  const db = createSupabaseAdminClient();
  if (!db) return fail("Database services are not configured.", 503);
  const { path } = await params;
  const [resource, id] = path;
  const body = await parseBody(request);
  if (!body) return fail("Request body must be valid JSON.");

  if (resource === "applications" && id) {
    const status = body.status;
    const expectedUpdatedAt = body.expectedUpdatedAt;
    if (typeof status !== "string" || !["under_review", "approved", "rejected"].includes(status)) return fail("Choose a valid application decision.");
    if (typeof expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(expectedUpdatedAt))) {
      return fail("Refresh the application list before making a decision.", 409);
    }
    const { data, error } = await db.from("applications")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("updated_at", expectedUpdatedAt)
      .in("status", ["submitted", "under_review"])
      .select("id,status,updated_at")
      .maybeSingle();
    if (error) return fail("Could not update application status.", 500);
    if (!data) return fail("This application changed after you loaded it. Refresh the list and review its current status before deciding.", 409);
    await writeAuditLog({
      actorId: context.user.id,
      eventType: `application.${status}`,
      relatedRecordId: id,
      metadata: { new_status: status },
    });
    const { data: application } = await db.from("applications").select("student_id").eq("id", id).single();
    if (application) {
      const { error: notificationError } = await db.from("notifications").insert({
        student_id: application.student_id,
        title: `Application ${status.replace("_", " ")}`,
        body: `Your application status has been updated to ${status.replace("_", " ")}.`,
      });
      if (notificationError) console.error("Could not notify student about application decision:", notificationError.message);
      else await sendPushToStudent(
        application.student_id,
        `Application ${status.replace("_", " ")}`,
        `Your application status has been updated to ${status.replace("_", " ")}.`,
      );
    }
    return NextResponse.json({ data });
  }
  if (resource === "programmes" && id) {
    const { data: current, error: currentError } = await db.from("programmes").select("price_minor,price_approved,is_published,is_listed").eq("id", id).maybeSingle();
    if (currentError) return fail("Could not check the current programme.", 500);
    if (!current) return fail("Programme not found.", 404);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of ["name", "summary", "category", "slug", "duration", "currency", "entry_requirements"]) {
      if (key in body) {
        const value = body[key];
        if (value !== null && typeof value !== "string") return fail(`Invalid ${key}.`);
        patch[key] = value === null ? null : text(value, key === "summary" ? 2000 : 500);
        if (value !== null && patch[key] === null) return fail(`Invalid ${key}.`);
      }
    }
    if ("price_minor" in body) {
      const price = body.price_minor === "" || body.price_minor === null ? null : Number(body.price_minor);
      if (price !== null && (!Number.isSafeInteger(price) || price < 0)) return fail("Enter a valid non-negative programme price.");
      patch.price_minor = price;
    }
    if ("price_approved" in body) patch.price_approved = body.price_approved === true;
    if ("currency" in body && body.currency !== "NGN") return fail("Only NGN payments are supported.");
    if ("is_published" in body) patch.is_published = body.is_published === true;
    if ("is_listed" in body) patch.is_listed = body.is_listed === true;
    if ("image_path" in body) {
      if (body.image_path !== null && !validProgrammeImagePath(body.image_path)) return fail("Choose a valid uploaded programme image.");
      patch.image_path = body.image_path;
    }
    const effectivePrice = "price_minor" in patch ? patch.price_minor : current.price_minor;
    const effectiveApproval = "price_approved" in patch ? patch.price_approved : current.price_approved;
    const effectivePublication = "is_published" in patch ? patch.is_published : current.is_published;
    if (effectivePublication === true) patch.is_listed = true;
    if (effectivePublication === true && (effectiveApproval !== true || typeof effectivePrice !== "number" || effectivePrice <= 0)) return fail("Approve a positive programme price before publishing.");
    for (const key of ["curriculum", "outcomes"]) {
      if (key in body) {
        if (!Array.isArray(body[key]) || !(body[key] as unknown[]).every((item) => typeof item === "string")) return fail(`Invalid ${key}.`);
        patch[key] = (body[key] as string[]).map((item) => item.trim()).filter(Boolean).slice(0, 50);
      }
    }
    const { data, error } = await db.from("programmes").update(patch).eq("id", id).select("*").maybeSingle();
    if (error) return fail(error.code === "23505" ? "A programme already uses this slug." : "Could not update programme.", 400);
    if (!data) return fail("Programme not found.", 404);
    await writeAuditLog({
      actorId: context.user.id,
      eventType: "programme.updated",
      relatedRecordId: id,
      metadata: { changed_fields: Object.keys(patch).filter((key) => key !== "updated_at") },
    });
    return NextResponse.json({ data });
  }
  if (resource === "announcements" && id) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ("title" in body) patch.title = text(body.title, 180);
    if ("body" in body) patch.body = text(body.body, 5000);
    if ("published" in body) {
      patch.published = body.published === true;
      patch.published_at = body.published === true ? new Date().toISOString() : null;
    }
    const { data, error } = await db.from("announcements").update(patch).eq("id", id).select("*").maybeSingle();
    if (error) return fail("Could not update announcement.", 500);
    if (!data) return fail("Announcement not found.", 404);
    return NextResponse.json({ data });
  }
  if (resource === "settings" && id === "organization") {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: context.user.id };
    for (const key of ["organization_name", "contact_email", "contact_phone"]) {
      if (key in body) {
        const value = typeof body[key] === "string" ? (body[key] as string).trim() : null;
        if (value === null || value.length > 200 || (key === "organization_name" && !value)) return fail(`Enter a valid ${key.replace("_", " ")}.`);
        if (key === "contact_email" && value && !/^\S+@\S+\.\S+$/.test(value)) return fail("Enter a valid public contact email.");
        patch[key] = value;
      }
    }
    const { data, error } = await db.from("organization_settings").upsert({ id: true, ...patch }).select("*").single();
    if (error) return fail("Could not save organization settings.", 500);
    return NextResponse.json({ data });
  }
  return fail("This resource cannot be updated.", 404);
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const context = await getAdminRequestContext();
  if (!context.ok) return fail(context.error, context.status);
  const db = createSupabaseAdminClient();
  if (!db) return fail("Database services are not configured.", 503);
  const { path } = await params;
  const [resource, id] = path;
  if (!resource) return fail("Dashboard resource is required.", 404);
  if (resource === "programmes" && id) {
    const { data, error } = await db.from("programmes").update({ is_published: false, updated_at: new Date().toISOString() }).eq("id", id).select("id").maybeSingle();
    if (error) return fail("Could not unpublish programme.", 500);
    if (!data) return fail("Programme not found.", 404);
    return NextResponse.json({ data });
  }
  if (resource === "announcements" && id) {
    const { error } = await db.from("announcements").delete().eq("id", id);
    if (error) return fail("Could not delete announcement.", 500);
    return NextResponse.json({ success: true });
  }
  if (resource === "schedule" && id) {
    const { error } = await db.from("training_sessions").delete().eq("id", id);
    if (error) return fail("Could not delete training session.", 500);
    return NextResponse.json({ success: true });
  }
  return fail("This resource cannot be deleted.", 404);
}
