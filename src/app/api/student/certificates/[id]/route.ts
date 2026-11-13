import { NextResponse, type NextRequest } from "next/server";
import { getStudentRequestContext } from "@/lib/api-auth";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await getStudentRequestContext();
  if (!context.ok) return NextResponse.json({ error: context.error }, { status: context.status });
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Certificate was not found." }, { status: 404 });
  }
  const { data, error } = await context.supabase.from("certificates")
    .select("storage_path")
    .eq("id", id)
    .eq("student_id", context.user.id)
    .maybeSingle();
  if (error) {
    console.error("Could not check certificate access:", error.message);
    return NextResponse.json({ error: "Could not retrieve certificate." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Certificate was not found." }, { status: 404 });
  const { data: signed, error: signingError } = await context.supabase.storage
    .from("student-certificates")
    .createSignedUrl(data.storage_path, 120, { download: true });
  if (signingError || !signed?.signedUrl) {
    if (signingError) console.error("Could not create certificate download URL:", signingError.message);
    return NextResponse.json({ error: "Could not prepare certificate download." }, { status: 500 });
  }
  return NextResponse.redirect(signed.signedUrl, { headers: { "Cache-Control": "private, no-store" } });
}
