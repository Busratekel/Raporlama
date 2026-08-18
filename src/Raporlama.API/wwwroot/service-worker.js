const CACHE = 'rapor-shell-v7';

const SHELL = [
  '/login.html',
  '/menu.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/raporlar/rapor-ortak.css',
  '/raporlar/rapor-nav.js',
  '/raporlar/theme.js',
  '/pwa.js',
  '/images/pwa-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function isApiRequest(url) {
  return url.pathname.startsWith('/api/')
    || url.pathname.startsWith('/Auth/')
    || url.pathname.startsWith('/auth/');
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (isApiRequest(url)) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/offline.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});

self.addEventListener('push', (event) => {
  let data = { title: 'Bellona Raporlama', body: 'Yeni bildirim', url: '/menu.html', notificationId: null };
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (_) { /* varsayılan */ }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/images/pwa-icon.png',
      badge: '/images/pwa-icon.png',
      data: {
        url: data.url || '/menu.html',
        notificationId: data.notificationId || null
      }
    })
  );
});

function normalizeReportUrl(raw) {
  if (!raw || !String(raw).trim()) return '/menu.html';
  let url = String(raw).trim().replace(/\\/g, '/');
  if (/^https?:\/\//i.test(url)) return url;
  url = url.replace(/^\/+/, '');
  if (!url.toLowerCase().startsWith('raporlar/')) url = 'raporlar/' + url;
  if (!url.toLowerCase().endsWith('.html')) url += '.html';
  return url.startsWith('/') ? url : '/' + url;
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = normalizeReportUrl(data.url);
  const notificationId = data.notificationId;

  event.waitUntil((async () => {
    if (notificationId) {
      try {
        await fetch('/api/push/inbox/' + notificationId + '/read', {
          method: 'POST',
          credentials: 'include'
        });
      } catch (_) { /* offline */ }
    }

    const list = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of list) {
      if ('focus' in client) {
        await client.focus();
        client.postMessage({ type: 'inbox-changed' });
        return;
      }
    }
    if (clients.openWindow) {
      await clients.openWindow(targetUrl);
    }
  })());
});
