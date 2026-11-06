"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";

function decodeVapidKey(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Uint8Array.from(window.atob(padded), (char) => char.charCodeAt(0));
}

export function PushNotificationControl() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setEnabled(false);
      setMessage("This browser does not support push notifications.");
      return;
    }
    navigator.serviceWorker.getRegistration("/")
      .then(async (registration) => setEnabled(Boolean(await registration?.pushManager.getSubscription())))
      .catch(() => {
        setEnabled(false);
        setMessage("Could not check notification settings in this browser.");
      });
  }, []);

  async function toggle() {
    setBusy(true);
    setMessage("");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        throw new Error("This browser does not support push notifications.");
      }
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        const response = await fetch("/api/student/push-subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: existing.endpoint }),
        });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error || "Could not disable push notifications.");
        await existing.unsubscribe();
        setEnabled(false);
        setMessage("Browser notifications are off.");
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("Browser push notifications are not configured on this server.");
      const permission = Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
      if (permission !== "granted") throw new Error(permission === "denied"
        ? "Notifications are blocked in browser settings. Allow them for this site to continue."
        : "Notification permission was not granted.");

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(publicKey),
      });
      const response = await fetch("/api/student/push-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not enable push notifications.");
      setEnabled(true);
      setMessage("Browser notifications are on.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not update notification settings.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="push-notification-control" aria-label="Browser notification settings">
    <span className="push-notification-icon"><BellRing size={18} /></span>
    <div><strong>Browser notifications</strong><p>{message || (enabled ? "Get important student updates on this device." : "Choose whether to receive updates on this device.")}</p></div>
    <button className="button button-outline button-small" type="button" onClick={() => void toggle()} disabled={busy || enabled === null}>
      {busy ? "Updating…" : enabled ? "Turn off" : "Turn on"}
    </button>
  </section>;
}
