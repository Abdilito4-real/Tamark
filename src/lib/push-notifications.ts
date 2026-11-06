import webpush from "web-push";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function vapidDetails() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.PUSH_VAPID_PRIVATE_KEY;
  const subject = process.env.PUSH_VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

export async function sendPushToStudent(studentId: string, title: string, body: string, url = "/student/notifications") {
  const vapid = vapidDetails();
  if (!vapid) {
    console.warn("Web Push is not configured; the in-app notification was saved without a browser push.");
    return;
  }
  const db = createSupabaseAdminClient();
  if (!db) {
    console.error("Could not send browser push: Supabase admin service is not configured.");
    return;
  }

  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  const { data, error } = await db.from("push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .eq("student_id", studentId);
  if (error) {
    console.error("Could not load browser push subscriptions:", error.message);
    return;
  }

  const payload = JSON.stringify({ title, body, url });
  await Promise.all((data ?? []).map(async (subscription: PushSubscriptionRow) => {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        payload,
        { TTL: 60 * 60 * 24 },
      );
    } catch (reason) {
      const error = reason as { statusCode?: number; message?: string };
      if (error.statusCode === 404 || error.statusCode === 410) {
        const { error: deleteError } = await db.from("push_subscriptions").delete().eq("id", subscription.id);
        if (deleteError) console.error("Could not remove expired browser push subscription:", deleteError.message);
      } else {
        console.error("Could not deliver browser push:", error.message ?? "Unknown Web Push error.");
      }
    }
  }));
}
