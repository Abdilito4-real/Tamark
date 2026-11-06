self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Tamark Solar Energy", body: "You have a new update." };
  }
  const title = typeof payload.title === "string" ? payload.title : "Tamark Solar Energy";
  const options = {
    body: typeof payload.body === "string" ? payload.body : "You have a new update.",
    icon: "/icons/solar-leaf-energy-192.png",
    badge: "/icons/solar-leaf-energy-192.png",
    data: { url: typeof payload.url === "string" ? payload.url : "/student/notifications" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requested = new URL(event.notification.data?.url || "/student/notifications", self.location.origin);
  const target = requested.origin === self.location.origin ? requested.href : new URL("/student/notifications", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) return existing.navigate(target).then(() => existing.focus());
    return self.clients.openWindow(target);
  }));
});
