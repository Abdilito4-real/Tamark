import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendPushToStudent } from "@/lib/push-notifications";
import { writeAuditLog } from "@/lib/api-security";
export { verifyPaystackSignature } from "@/lib/paystack-signature.mjs";

type PaystackVerification = {
  status?: boolean;
  data?: {
    status?: string;
    reference?: string;
    amount?: number;
    currency?: string;
    customer?: { email?: string };
  };
};

export function getPaystackSecret() {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const mode = process.env.PAYSTACK_MODE ?? "test";
  if (mode !== "test" && mode !== "live") return null;
  const expectedPrefix = mode === "test" ? "sk_test_" : "sk_live_";
  return secret?.startsWith(expectedPrefix) ? secret : null;
}

export async function confirmPaystackTransaction(reference: string) {
  const secret = getPaystackSecret();
  const admin = createSupabaseAdminClient();
  if (!secret || !admin) throw new Error("Payment verification services are not configured.");

  const { data: payment, error: lookupError } = await admin.from("payments")
    .select("id,application_id,student_id,amount_minor,currency,status,customer_email")
    .eq("provider_reference", reference)
    .maybeSingle();
  if (lookupError) throw new Error(`Could not load payment record: ${lookupError.message}`);
  if (!payment) throw new Error("Payment reference was not found.");

  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Paystack verification request failed.");
  const result = await response.json() as PaystackVerification;
  const transaction = result.data;
  if (!result.status || transaction?.reference !== reference) throw new Error("Paystack returned an invalid verification response.");

  const verified = transaction.status === "success" &&
    transaction.amount === payment.amount_minor &&
    transaction.currency === payment.currency &&
    typeof payment.customer_email === "string" &&
    transaction.customer?.email?.toLowerCase() === payment.customer_email.toLowerCase();
  if (!verified) {
    if (transaction.status === "failed" && payment.status === "pending") {
      const { error } = await admin.from("payments").update({ status: "failed" }).eq("id", payment.id).eq("status", "pending");
      if (error) throw new Error(`Could not update payment status: ${error.message}`);
      await writeAuditLog({
        actorId: payment.student_id,
        eventType: "payment.failed",
        relatedRecordId: payment.id,
        metadata: { reason: "provider_reported_failure" },
      });
    }
    if (transaction.status !== "failed") {
      await writeAuditLog({
        actorId: payment.student_id,
        eventType: "payment.verification_mismatch",
        relatedRecordId: payment.id,
        metadata: { provider_status: transaction.status ?? "unknown" },
      });
    }
    return { verified: false, applicationId: payment.application_id };
  }

  const { data: applicationId, error: finalizeError } = await admin.rpc("finalize_verified_payment", { p_reference: reference });
  if (finalizeError || !applicationId) throw new Error(`Could not finalize the verified payment and application: ${finalizeError?.message ?? "No application was returned."}`);
  if (payment.status !== "successful") {
    await sendPushToStudent(
      payment.student_id,
      "Payment verified",
      "Your payment has been verified. Review and submit your application to complete it.",
    );
  }
  return { verified: true, applicationId };
}
