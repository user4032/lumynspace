/* Lumyn service worker: web push + клік по сповіщенні */
self.addEventListener("install", () => self.skipWaiting())

self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Lumyn", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-96.png",
      tag: data.tag || "lumyn",
      data: { url: data.url || "/" },
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || "/"
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      for (const w of windows) {
        if ("focus" in w) {
          if ("navigate" in w) await w.navigate(url)
          return w.focus()
        }
      }
      return self.clients.openWindow(url)
    })()
  )
})
