import { NextResponse, type NextRequest } from "next/server";
import { getAdminRequestContext } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/api-security";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getPaystackSecret } from "@/lib/paystack";

type ProviderTransaction = {
  reference: string;
  status: string;
  amount: number;
  currency: string;
};

function invalid(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const context = await getAdminRequestContext();
  if (!context.ok) return invalid(context.error, context.status);
  const secret = getPaystackSecret();
  const admin = createSupabaseAdminClient();
  if (!secret || !admin) return invalid("Reconciliation services are not configured.", 503);

  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const from = request.nextUrl.searchParams.get("from") ?? defaultFrom.toISOString();
  const to = request.nextUrl.searchParams.get("to") ?? now.toISOString();
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (!Number.isFinite(fromDate.getTime()) || !Number.isFinite(toDate.getTime()) ||
      fromDate > toDate || toDate.getTime() - fromDate.getTime() > 31 * 24 * 60 * 60 * 1000) {
    return invalid("Choose a valid date range no longer than 31 days.");
  }

  const { data: internal, count: internalCount, error: internalError } = await admin.from("payments")
    .select("id,provider_reference,amount_minor,currency,status,created_at", { count: "exact" })
    .gte("created_at", fromDate.toISOString())
    .lte("created_at", toDate.toISOString())
    .order("created_at", { ascending: false })
    .limit(1000);
  if (internalError) return invalid("Could not load internal payment records.", 500);
  if ((internalCount ?? 0) > 1000) return invalid("Narrow the date range; reconciliation is limited to 1000 transactions per run.", 413);

  const providerTransactions: ProviderTransaction[] = [];
  for (let page = 1; page <= 10; page += 1) {
    let response: Response;
    try {
      const url = new URL("https://api.paystack.co/transaction");
      url.searchParams.set("from", fromDate.toISOString());
      url.searchParams.set("to", toDate.toISOString());
      url.searchParams.set("perPage", "100");
      url.searchParams.set("page", String(page));
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${secret}` },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      return invalid("Paystack reconciliation could not be reached.", 502);
    }
    if (!response.ok) return invalid("Paystack reconciliation request failed.", 502);
    let payload: { status?: boolean; data?: ProviderTransaction[]; meta?: { pageCount?: number } };
    try { payload = await response.json() as typeof payload; } catch { return invalid("Paystack returned an invalid reconciliation response.", 502); }
    if (!payload.status || !Array.isArray(payload.data)) return invalid("Paystack returned an invalid reconciliation response.", 502);
    if ((payload.meta?.pageCount ?? 1) > 10) return invalid("Narrow the date range; Paystack returned more than 1000 transactions.", 413);
    providerTransactions.push(...payload.data.filter((item) =>
      typeof item.reference === "string" && typeof item.status === "string" &&
      Number.isSafeInteger(item.amount) && typeof item.currency === "string",
    ));
    if (page >= (payload.meta?.pageCount ?? 1)) break;
  }

  const byReference = new Map(providerTransactions.map((transaction) => [transaction.reference, transaction]));
  const internalReferences = new Set((internal ?? []).map((payment) => payment.provider_reference));
  const discrepancies: Array<{ type: string; reference: string; internalStatus?: string; providerStatus?: string }> = [];
  const oldestPendingBefore = Date.now() - 24 * 60 * 60 * 1000;
  for (const payment of internal ?? []) {
    const provider = byReference.get(payment.provider_reference);
    if (["initiated", "pending"].includes(payment.status) && new Date(payment.created_at).getTime() < oldestPendingBefore) {
      discrepancies.push({ type: "pending_payment_requires_investigation", reference: payment.provider_reference, internalStatus: payment.status });
    }
    if (!provider) {
      if (payment.status === "successful") discrepancies.push({ type: "successful_internal_missing_at_provider", reference: payment.provider_reference, internalStatus: payment.status });
      continue;
    }
    if (payment.status === "successful" && provider.status !== "success") {
      discrepancies.push({ type: "successful_internal_not_successful_at_provider", reference: payment.provider_reference, internalStatus: payment.status, providerStatus: provider.status });
    }
    if (provider.amount !== payment.amount_minor) discrepancies.push({ type: "amount_mismatch", reference: payment.provider_reference });
    if (provider.currency !== payment.currency) discrepancies.push({ type: "currency_mismatch", reference: payment.provider_reference });
  }
  const providerCounts = new Map<string, number>();
  for (const transaction of providerTransactions) providerCounts.set(transaction.reference, (providerCounts.get(transaction.reference) ?? 0) + 1);
  for (const [reference, count] of providerCounts) {
    if (count > 1) discrepancies.push({ type: "duplicate_provider_reference", reference });
    const provider = byReference.get(reference);
    if (provider?.status === "success" && !internalReferences.has(reference)) {
      discrepancies.push({ type: "successful_provider_missing_internally", reference, providerStatus: provider.status });
    }
  }

  const { data: pendingRefunds, error: refundError } = await admin.from("refunds")
    .select("id,payment_id,provider_reference,created_at")
    .eq("status", "pending")
    .gte("created_at", fromDate.toISOString())
    .lte("created_at", toDate.toISOString())
    .limit(500);
  if (refundError) return invalid("Could not load refund reconciliation records.", 500);
  for (const refund of pendingRefunds ?? []) {
    discrepancies.push({
      type: "refund_pending_provider_confirmation",
      reference: refund.provider_reference ?? String(refund.id),
    });
  }

  await writeAuditLog({
    actorId: context.user.id,
    eventType: "finance.reconciliation_run",
    metadata: { from: fromDate.toISOString(), to: toDate.toISOString(), record_count: discrepancies.length },
    correlationId: request.headers.get("x-vercel-id"),
  });
  return NextResponse.json({
    range: { from: fromDate.toISOString(), to: toDate.toISOString() },
    providerRecords: providerTransactions.length,
    internalRecords: internal?.length ?? 0,
    discrepancies,
    pendingRefunds: pendingRefunds?.length ?? 0,
    automaticChanges: false,
  });
}
