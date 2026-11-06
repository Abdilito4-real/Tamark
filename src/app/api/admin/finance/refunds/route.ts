import { NextResponse, type NextRequest } from "next/server";
import { getAdminRequestContext } from "@/lib/api-auth";
import { consumeRateLimit, writeAuditLog } from "@/lib/api-security";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getPaystackSecret } from "@/lib/paystack";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const context = await getAdminRequestContext();
  if (!context.ok) return fail(context.error, context.status);
  const admin = createSupabaseAdminClient();
  if (!admin) return fail("Database services are not configured.", 503);
  const { data, error } = await admin.from("refunds")
    .select("id,payment_id,requested_by,amount_minor,currency,reason,provider_reference,status,created_at,updated_at,payments(provider_reference,student_id)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return fail("Could not load refund records.", 500);
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const context = await getAdminRequestContext();
  if (!context.ok) return fail(context.error, context.status);
  const secret = getPaystackSecret();
  const admin = createSupabaseAdminClient();
  if (!secret || !admin) return fail("Refund services are not configured.", 503);

  let allowed: boolean;
  try {
    allowed = await consumeRateLimit(`refund:${context.user.id}`, 3, 60);
  } catch {
    return fail("Refund services are temporarily unavailable.", 503);
  }
  if (!allowed) return fail("Too many refund attempts. Try again shortly.", 429);

  let body: unknown;
  try { body = await request.json(); } catch { return fail("Request body must be valid JSON."); }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return fail("Request body must be a JSON object.");
  const values = body as Record<string, unknown>;
  if (values.confirm !== true || typeof values.paymentId !== "string" ||
      typeof values.reason !== "string" || values.reason.trim().length < 3 || values.reason.trim().length > 1000) {
    return fail("Confirm the full refund and provide a reason of 3 to 1000 characters.");
  }

  const { data: payment, error: paymentError } = await admin.from("payments")
    .select("id,student_id,provider_reference,amount_minor,currency,status")
    .eq("id", values.paymentId)
    .maybeSingle();
  if (paymentError) return fail("Could not verify refund eligibility.", 500);
  if (!payment || payment.status !== "successful") return fail("Only successful, not-yet-refunded payments are eligible.", 409);

  const { data: prior, error: priorError } = await admin.from("refunds")
    .select("id,status")
    .eq("payment_id", payment.id)
    .in("status", ["pending", "processed"])
    .maybeSingle();
  if (priorError) return fail("Could not check the refund history.", 500);
  if (prior) return fail("A pending or completed refund already exists for this payment.", 409);

  const reason = values.reason.trim();
  const { data: refund, error: insertError } = await admin.from("refunds").insert({
    payment_id: payment.id,
    requested_by: context.user.id,
    amount_minor: payment.amount_minor,
    currency: payment.currency,
    reason,
    status: "pending",
  }).select("id").single();
  if (insertError) return fail(insertError.code === "23505" ? "A refund is already pending for this payment." : "Could not record refund request.", 409);

  await writeAuditLog({
    actorId: context.user.id,
    eventType: "refund.requested",
    relatedRecordId: refund.id,
    metadata: { payment_id: payment.id, amount_minor: payment.amount_minor, currency: payment.currency },
    correlationId: request.headers.get("x-vercel-id"),
  });

  let providerResponse: Response;
  try {
    providerResponse = await fetch("https://api.paystack.co/refund", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        transaction: payment.provider_reference,
        amount: payment.amount_minor,
        customer_note: reason,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return fail("Paystack refund status is unknown. The request is recorded as pending; reconcile it before retrying.", 502);
  }

  let payload: {
    status?: boolean;
    data?: { id?: string | number; status?: string };
  };
  try { payload = await providerResponse.json() as typeof payload; } catch {
    return fail("Paystack returned an unreadable refund response. Reconcile the pending request before retrying.", 502);
  }
  if (!providerResponse.ok || payload.status !== true) {
    const { error } = await admin.rpc("record_refund_provider_result", {
      p_refund_id: refund.id,
      p_provider_reference: null,
      p_provider_status: "failed",
      p_response: { http_status: providerResponse.status, outcome: "provider_rejected" },
    });
    if (error) return fail("Provider rejected the refund, but the result could not be recorded. Reconcile before retrying.", 502);
    return fail("Paystack did not accept the refund request.", 502);
  }

  const providerStatus = payload.data?.status;
  if (providerStatus !== "pending" && providerStatus !== "processed") {
    return fail("Paystack returned an unrecognized refund status. The request remains pending for reconciliation.", 502);
  }
  const providerReference = payload.data?.id == null ? null : String(payload.data.id);
  const { data: finalStatus, error: recordError } = await admin.rpc("record_refund_provider_result", {
    p_refund_id: refund.id,
    p_provider_reference: providerReference,
    p_provider_status: providerStatus,
    p_response: { provider_status: providerStatus },
  });
  if (recordError) return fail("Paystack accepted the refund, but its result could not be recorded. Reconcile before retrying.", 502);
  return NextResponse.json({ refundId: refund.id, status: finalStatus }, { status: 201 });
}
