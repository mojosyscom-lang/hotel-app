async function notifyAllClients_(msg){
  const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
  for(const c of allClients){
    c.postMessage(msg);
  }
}


self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e){}

  const title = data.title || "Hotel CRM";
  const body = data.body || "Notification";
  const url = data.url || "/";

  event.waitUntil((async ()=>{
    await notifyAllClients_({
      type: "SW_DEBUG",
      source: "push",
      title,
      body,
      url
    });

    await self.registration.showNotification(title, {
      body,
      data: { url },
      icon: "./assets/icons/icon-192.png",
      badge: "./assets/icons/icon-192.png",
      tag: "hotelcrm-test",
      renotify: true,
      requireInteraction: true,
      silent: false
    });
  })());
});

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { url },
      icon: "./assets/icons/icon-192.png",
      badge: "./assets/icons/icon-192.png",
      tag: "hotelcrm-test",
      renotify: true,
      requireInteraction: true,
      silent: false
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
   const rawUrl = (event.notification && event.notification.data && event.notification.data.url) || "./";
  // Resolve relative URLs under the app scope (GitHub Pages repo path)
  const url = new URL(rawUrl, self.registration.scope).toString();

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





