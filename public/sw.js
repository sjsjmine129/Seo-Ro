/* Seo-Ro (서로) - Service Worker for Web Push */
self.addEventListener("push", (event) => {
  let data = { title: "Seo-Ro", body: "", icon: "/apple-icon.png" };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Seo-Ro", {
      body: data.body,
      icon: data.icon || "/apple-icon.png",
      badge: "/apple-icon.png",
      tag: data.tag || "seoro-notification",
      data: { url: data.url || "/" },
      requireInteraction: false,
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
