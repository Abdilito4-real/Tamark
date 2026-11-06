import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function consumeRateLimit(bucket: string, limit: number, windowSeconds: number) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Rate limiting is not configured.");
  const bucketKey = createHash("sha256").update(bucket).digest("hex");
  const { data, error } = await admin.rpc("consume_api_rate_limit", {
    p_bucket_key: bucketKey,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error(`Could not apply API rate limit: ${error.message}`);
  return data === true;
}

export async function writeAuditLog({
  actorId,
  eventType,
  relatedRecordId,
  metadata = {},
  correlationId,
}: {
  actorId: string | null;
  eventType: string;
  relatedRecordId?: string | null;
  metadata?: Record<string, unknown>;
  correlationId?: string | null;
}) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Audit logging is not configured.");
  const { error } = await admin.rpc("write_audit_log", {
    p_actor_id: actorId,
    p_event_type: eventType,
    p_related_record_id: relatedRecordId ?? null,
    p_metadata: metadata,
    p_correlation_id: correlationId ?? null,
  });
  if (error) throw new Error(`Could not write audit log: ${error.message}`);
}
