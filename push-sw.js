self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e){}

  const title = data.title || "Hotel CRM";
  const body = data.body || "Notification";
  const url = data.url || "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { url }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification && event.notification.data && event.notification.data.url) || "/";

  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });

    // If already open, focus + navigate
    for (const c of allClients) {
      if ("focus" in c) {
        c.postMessage({ type: "DEEPLINK", url });
        return c.focus();
      }
    }

    // Otherwise open a new window
    if (clients.openWindow) return clients.openWindow(url);
  })());
});





