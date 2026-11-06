import { NextResponse, type NextRequest } from "next/server";
import { getStudentRequestContext } from "@/lib/api-auth";
import { consumeRateLimit } from "@/lib/api-security";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> },
) {
  const context = await getStudentRequestContext();
  if (!context.ok) return NextResponse.json({ error: context.error }, { status: context.status });

  let allowed: boolean;
  try {
    allowed = await consumeRateLimit(`application-submit:${context.user.id}`, 5, 60);
  } catch {
    return NextResponse.json({ error: "Application submission is temporarily unavailable." }, { status: 503 });
  }
  if (!allowed) return NextResponse.json({ error: "Too many submission attempts. Try again shortly." }, { status: 429 });

  const { applicationId } = await params;
  const { data, error } = await context.supabase.rpc("submit_paid_application", {
    p_application_id: applicationId,
  });
  if (error) {
    if (error.message.includes("not found")) return NextResponse.json({ error: "Application was not found." }, { status: 404 });
    if (error.message.includes("verified payment") || error.message.includes("not a draft")) {
      return NextResponse.json({ error: "A successful payment is required before this draft can be submitted." }, { status: 409 });
    }
    console.error("Could not submit paid application:", error.message);
    return NextResponse.json({ error: "Could not submit your application." }, { status: 500 });
  }
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || typeof result.application_reference !== "string") {
    return NextResponse.json({ error: "Application submission returned an invalid result." }, { status: 500 });
  }
  return NextResponse.json({
    applicationId: result.application_id,
    applicationReference: result.application_reference,
  });
}
