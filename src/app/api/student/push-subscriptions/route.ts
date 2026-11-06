import { NextResponse, type NextRequest } from "next/server";
import { getStudentRequestContext } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type SubscriptionBody = {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
};

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const context = await getStudentRequestContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.PUSH_VAPID_PRIVATE_KEY || !process.env.PUSH_VAPID_SUBJECT) {
    return fail("Browser push notifications are not configured on this server.", 503);
  }
  const db = createSupabaseAdminClient();
  if (!db) return fail("Database services are not configured.", 503);

  let subscription: SubscriptionBody;
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) return fail("Invalid push subscription.");
    subscription = body as SubscriptionBody;
  } catch {
    return fail("Request body must be valid JSON.");
  }
  if (typeof subscription.endpoint !== "string" || subscription.endpoint.length > 2048) return fail("Invalid push endpoint.");
  try {
    if (new URL(subscription.endpoint).protocol !== "https:") return fail("Push endpoint must use HTTPS.");
  } catch {
    return fail("Invalid push endpoint.");
  }
  const p256dh = subscription.keys?.p256dh;
  const auth = subscription.keys?.auth;
  if (typeof p256dh !== "string" || !/^[A-Za-z0-9_-]{20,200}$/.test(p256dh) ||
      typeof auth !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(auth)) {
    return fail("Invalid push encryption keys.");
  }

  const { error } = await db.from("push_subscriptions").upsert({
    student_id: context.user.id,
    endpoint: subscription.endpoint,
    p256dh,
    auth,
    updated_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });
  if (error) {
    console.error("Could not save browser push subscription:", error.message);
    return fail("Could not enable browser push notifications.", 500);
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const context = await getStudentRequestContext();
  if (!context.ok) return fail(context.error, context.status);
  const db = createSupabaseAdminClient();
  if (!db) return fail("Database services are not configured.", 503);

  let endpoint: unknown;
  try {
    const body: unknown = await request.json();
    if (typeof body === "object" && body !== null && !Array.isArray(body)) endpoint = (body as { endpoint?: unknown }).endpoint;
  } catch {
    return fail("Request body must be valid JSON.");
  }
  if (typeof endpoint !== "string" || endpoint.length > 2048) return fail("Invalid push endpoint.");
  const { error } = await db.from("push_subscriptions").delete()
    .eq("student_id", context.user.id)
    .eq("endpoint", endpoint);
  if (error) {
    console.error("Could not remove browser push subscription:", error.message);
    return fail("Could not disable browser push notifications.", 500);
  }
  return NextResponse.json({ success: true });
}
