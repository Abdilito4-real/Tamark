import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { confirmPaystackTransaction, getPaystackSecret, verifyPaystackSignature } from "@/lib/paystack";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { writeAuditLog } from "@/lib/api-security";

export async function POST(request: NextRequest) {
  const secret = getPaystackSecret();
  const admin = createSupabaseAdminClient();
  if (!secret || !admin) return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 65_536) {
    return NextResponse.json({ error: "Webhook payload is too large." }, { status: 413 });
  }
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > 65_536) {
    return NextResponse.json({ error: "Webhook payload is too large." }, { status: 413 });
  }
  const signature = request.headers.get("x-paystack-signature") ?? "";
  if (!verifyPaystackSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let event: { event?: string; data?: { id?: number; reference?: string } };
  try { event = JSON.parse(rawBody) as typeof event; } catch { return NextResponse.json({ error: "Invalid webhook body." }, { status: 400 }); }
  const eventType = event.event;
  const reference = event.data?.reference;
  if (!eventType || !event.data || typeof event.data.id !== "number" && typeof reference !== "string") {
    return NextResponse.json({ error: "Webhook event is missing its identifier." }, { status: 400 });
  }
  if (["charge.success", "charge.failed"].includes(eventType) && typeof reference !== "string") {
    return NextResponse.json({ error: "Payment event is missing its transaction reference." }, { status: 400 });
  }
  const eventKey = createHash("sha256")
    .update(`${eventType}:${event.data.id ?? reference}`)
    .digest("hex");
  const payloadSha256 = createHash("sha256").update(rawBody).digest("hex");

  const { data: claims, error: claimError } = await admin.rpc("claim_paystack_webhook_event", {
    p_event_key: eventKey,
    p_event_type: eventType,
    p_provider_reference: reference ?? null,
    p_payload_sha256: payloadSha256,
  });
  if (claimError) return NextResponse.json({ error: "Webhook event could not be claimed." }, { status: 503 });
  const claim = Array.isArray(claims) ? claims[0] : null;
  if (claim?.outcome === "processed") return NextResponse.json({ received: true, duplicate: true });
  if (claim?.outcome === "busy") return NextResponse.json({ error: "Webhook event is already being processed." }, { status: 503 });
  if (claim?.claimed !== true) return NextResponse.json({ error: "Webhook event could not be claimed." }, { status: 503 });

  try {
    if (["charge.success", "charge.failed"].includes(eventType) && reference) {
      await confirmPaystackTransaction(reference);
    }
    const { error } = await admin.from("paystack_webhook_events").update({
      processing_status: "processed",
      processed_at: new Date().toISOString(),
      last_error: null,
    }).eq("event_key", eventKey);
    if (error) throw new Error(`Could not record webhook outcome: ${error.message}`);
    await writeAuditLog({
      actorId: null,
      eventType: "payment.webhook_processed",
      relatedRecordId: reference ?? eventKey,
      metadata: { provider_event: eventType, payload_sha256: payloadSha256 },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not process Paystack webhook.";
    console.error(message);
    const { error: updateError } = await admin.from("paystack_webhook_events").update({
      processing_status: "failed",
      last_error: "Provider verification or event processing failed.",
    }).eq("event_key", eventKey);
    if (updateError) console.error("Could not record webhook failure:", updateError.message);
    return NextResponse.json({ error: "Could not process payment event." }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
