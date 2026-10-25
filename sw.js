/*
 * Service worker: mostra as notificações (lembretes) mesmo com o portal fechado, e recebe o que se partilha
 * a partir de outras apps (Android: Partilhar → Família): extratos do banco (ficheiros) e links de receitas.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Partilha (manifest.webmanifest → share_target, POST para "partilhar"): os ficheiros ficam na cache até a
// página os ler (js/financas-orcamento.js); o texto / link segue para a página como antes (?title=&text=&url=).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'POST' || new URL(req.url).pathname !== new URL('partilhar', self.registration.scope).pathname) return;
  event.respondWith((async () => {
    const form = await req.formData();
    const files = form.getAll('extratos').filter((f) => f && typeof f !== 'string' && f.size);
    const page = (q) => Response.redirect(new URL(`index.html${q}`, self.registration.scope).href, 303);
    if (files.length) {
      const cache = await caches.open('portal-partilha');
      await Promise.all((await cache.keys()).map((k) => cache.delete(k)));
      await Promise.all(files.map((f, i) => cache.put(new URL(`partilha/${i}`, self.registration.scope).href,
        new Response(f, { headers: { 'Content-Type': f.type || 'application/octet-stream', 'X-Nome': encodeURIComponent(f.name || `extrato-${i + 1}`) } }))));
      return page('?extratos=1#/financas');
    }
    const q = new URLSearchParams();
    ['title', 'text', 'url'].forEach((k) => { const v = form.get(k); if (typeof v === 'string' && v) q.set(k, v); });
    return page(`?${q}`);
  })());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(self.registration.showNotification(data.title || 'Portal da Família', {
    body: data.body || '',
    icon: 'icons/icon-192.png',
    badge: 'icons/badge-96.png',
    tag: data.tag,
    data: { url: data.url || '#/painel' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(`index.html${event.notification.data?.url || ''}`, self.registration.scope).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = windows.find((w) => w.url.startsWith(self.registration.scope));
    if (open) {
      await open.focus();
      open.postMessage({ type: 'navigate', url: event.notification.data?.url || '#/painel' });
      return;
    }
    await self.clients.openWindow(target);
  })());
});
