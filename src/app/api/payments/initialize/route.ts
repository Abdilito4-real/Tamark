import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getStudentRequestContext } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getPaystackSecret } from "@/lib/paystack";
import { consumeRateLimit, writeAuditLog } from "@/lib/api-security";

export async function POST(request: NextRequest) {
  const secret = getPaystackSecret();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const admin = createSupabaseAdminClient();
  if (!secret || !siteUrl || !admin) return NextResponse.json({ error: "Secure payment services are not configured." }, { status: 503 });
  const context = await getStudentRequestContext();
  if (!context.ok) return NextResponse.json({ error: context.error }, { status: context.status });
  const { supabase, user } = context;
  if (!user.email) return NextResponse.json({ error: "A verified account email is required for payment." }, { status: 401 });
  let allowed: boolean;
  try {
    allowed = await consumeRateLimit(`payment-initialize:${user.id}`, 5, 60);
  } catch {
    return NextResponse.json({ error: "Payment services are temporarily unavailable." }, { status: 503 });
  }
  if (!allowed) return NextResponse.json({ error: "Too many payment attempts. Try again shortly." }, { status: 429 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  if (typeof body !== "object" || body === null || !("applicationId" in body) || typeof body.applicationId !== "string") {
    return NextResponse.json({ error: "A valid application is required." }, { status: 400 });
  }

  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select("id,student_id,status,programmes!inner(id,name,price_minor,currency,is_published,price_approved)")
    .eq("id", body.applicationId)
    .eq("student_id", user.id)
    .maybeSingle();
  if (applicationError) return NextResponse.json({ error: "Could not validate the application." }, { status: 500 });
  if (!application || application.status !== "draft") return NextResponse.json({ error: "Application is unavailable for payment." }, { status: 404 });

  const programme = application.programmes as unknown as { name: string; price_minor: number | null; currency: string; is_published: boolean; price_approved: boolean };
  if (!programme.is_published || !programme.price_approved || !programme.price_minor || programme.price_minor < 1 || programme.currency !== "NGN") {
    return NextResponse.json({ error: "The programme fee has not been approved for payment." }, { status: 409 });
  }

  const { data: activePayment, error: pendingError } = await admin.from("payments")
    .select("id,provider_reference,authorization_url,status,created_at,amount_minor,currency,customer_email")
    .eq("application_id", application.id)
    .in("status", ["initiated", "pending"])
    .maybeSingle();
  if (pendingError) return NextResponse.json({ error: "Could not check the existing payment." }, { status: 500 });
  if (activePayment?.status === "pending") {
    if (activePayment.authorization_url) return NextResponse.json({ authorizationUrl: activePayment.authorization_url });
    return NextResponse.json({ error: "Payment is still being prepared. Try again shortly." }, { status: 409 });
  }
  if (activePayment?.status === "initiated" &&
      Date.now() - new Date(activePayment.created_at).getTime() < 60_000) {
    return NextResponse.json({ error: "Payment is still being prepared. Try again shortly." }, { status: 409 });
  }

  const { data: existing, error: existingError } = await admin.from("payments")
    .select("status")
    .eq("application_id", application.id)
    .in("status", ["successful", "partially_refunded", "refunded"])
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: "Could not check the existing payment." }, { status: 500 });
  if (existing) return NextResponse.json({ error: "This application has already been paid." }, { status: 409 });

  const reference = activePayment?.provider_reference ?? `tamark_${randomUUID().replaceAll("-", "")}`;
  const paymentAmount = activePayment?.amount_minor ?? programme.price_minor;
  const paymentCurrency = activePayment?.currency ?? programme.currency;
  const paymentEmail = activePayment?.customer_email ?? user.email.toLowerCase();
  if (paymentEmail !== user.email.toLowerCase()) {
    return NextResponse.json({ error: "The account email changed during payment setup. Contact support before retrying." }, { status: 409 });
  }
  let callbackUrl: string;
  try { callbackUrl = new URL("/checkout/confirmation", siteUrl).toString(); } catch { return NextResponse.json({ error: "Payment callback URL is invalid." }, { status: 503 }); }

  let paymentId = activePayment?.id;
  if (!activePayment) {
    const { data: reserved, error: reserveError } = await admin.from("payments").insert({
      application_id: application.id,
      student_id: user.id,
      provider_reference: reference,
      amount_minor: paymentAmount,
      currency: paymentCurrency,
      customer_email: paymentEmail,
      authorization_url: null,
      status: "initiated",
    }).select("id").single();
    if (reserveError || !reserved) {
      if (reserveError?.code === "23505") {
        const { data: concurrent, error: concurrentError } = await admin.from("payments")
          .select("authorization_url,status")
          .eq("application_id", application.id)
          .in("status", ["initiated", "pending"])
          .maybeSingle();
        if (!concurrentError && concurrent?.status === "pending" && concurrent.authorization_url) {
          return NextResponse.json({ authorizationUrl: concurrent.authorization_url });
        }
        return NextResponse.json({ error: "A payment is already being prepared. Try again shortly." }, { status: 409 });
      }
      return NextResponse.json({ error: "Could not reserve a payment reference. Please try again." }, { status: 500 });
    }
    paymentId = reserved.id;
  }
  await writeAuditLog({
    actorId: user.id,
    eventType: "payment.initialized",
    relatedRecordId: reference,
    metadata: { application_id: application.id, amount_minor: paymentAmount, currency: paymentCurrency },
  });

  let paystackResponse: Response;
  try {
    paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: paymentEmail, amount: paymentAmount, currency: paymentCurrency, reference, callback_url: callbackUrl }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return NextResponse.json({ error: "Paystack could not be reached. Retry the same payment reference shortly; do not start a second payment." }, { status: 502 });
  }
  let payload: { status?: boolean; message?: string; data?: { authorization_url?: string; reference?: string } };
  try { payload = await paystackResponse.json() as typeof payload; } catch {
    return NextResponse.json({ error: "Paystack returned an invalid response. Retry this payment reference or contact support." }, { status: 502 });
  }
  if (!paystackResponse.ok || !payload.status || !payload.data?.authorization_url || payload.data.reference !== reference) {
    return NextResponse.json({ error: "Paystack could not initialize this transaction. The reference is retained for safe retry; contact support if it remains pending." }, { status: 502 });
  }

  const { data: updated, error: updateError } = await admin.from("payments")
    .update({ authorization_url: payload.data.authorization_url, status: "pending" })
    .eq("id", paymentId)
    .eq("status", "initiated")
    .select("id")
    .maybeSingle();
  if (updateError || !updated) {
    return NextResponse.json({ error: "Paystack initialized payment but the local record could not be updated. Contact support before retrying." }, { status: 500 });
  }
  return NextResponse.json({ authorizationUrl: payload.data.authorization_url });
}
