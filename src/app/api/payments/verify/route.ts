import { NextResponse, type NextRequest } from "next/server";
import { getStudentRequestContext } from "@/lib/api-auth";
import { confirmPaystackTransaction } from "@/lib/paystack";
import { consumeRateLimit } from "@/lib/api-security";

export async function POST(request: NextRequest) {
  const context = await getStudentRequestContext();
  if (!context.ok) return NextResponse.json({ error: context.error }, { status: context.status });
  const { supabase, user } = context;
  let allowed: boolean;
  try {
    allowed = await consumeRateLimit(`payment-verify:${user.id}`, 12, 60);
  } catch {
    return NextResponse.json({ error: "Payment verification is temporarily unavailable." }, { status: 503 });
  }
  if (!allowed) return NextResponse.json({ error: "Too many verification attempts. Try again shortly." }, { status: 429 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  if (typeof body !== "object" || body === null || !("reference" in body) || typeof body.reference !== "string") {
    return NextResponse.json({ error: "A valid payment reference is required." }, { status: 400 });
  }
  const { data: payment, error: paymentError } = await supabase.from("payments")
    .select("id")
    .eq("provider_reference", body.reference)
    .eq("student_id", user.id)
    .maybeSingle();
  if (paymentError) return NextResponse.json({ error: "Could not validate payment ownership." }, { status: 500 });
  if (!payment) return NextResponse.json({ error: "Payment was not found for this account." }, { status: 404 });

  try {
    const result = await confirmPaystackTransaction(body.reference);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment verification failed.";
    console.error(message);
    return NextResponse.json({ error: "We could not verify this payment yet. Refresh the page to retry." }, { status: 502 });
  }
}
