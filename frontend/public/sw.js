// Service worker do MyCosts. So cuida das notificacoes (Web Push): nao faz
// cache, entao o app continua sempre buscando a versao mais nova.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let m = { titulo: "MyCosts", corpo: "", tag: undefined };
  try {
    m = { ...m, ...e.data.json() };
  } catch {
    if (e.data) m.corpo = e.data.text();
  }
  e.waitUntil(
    self.registration.showNotification(m.titulo, {
      body: m.corpo,
      tag: m.tag,
      icon: "/icon.svg",
      badge: "/icon.svg",
    }),
  );
});

// Tocar na notificacao abre o app (ou traz para frente a aba que ja esta aberta).
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((abertas) => {
      const aba = abertas.find((c) => new URL(c.url).origin === self.location.origin);
      return aba ? aba.focus() : self.clients.openWindow("/");
    }),
  );
});
