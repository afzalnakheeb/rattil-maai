// Offline support: the app shell is cached; Quran text is cached as it is read.
const VERSION = 'rwm-v17';
const SHELL = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-small.svg', 'icons/icon-192.png',
  'js/app.js', 'js/store.js', 'js/ui.js', 'js/icons.js', 'js/arabic.js', 'js/quran.js', 'js/plan.js', 'js/adhkar.js',
  'js/speech.js', 'js/player.js', 'js/session.js', 'js/config.js', 'js/cloud.js', 'js/account.js', 'js/records.js',
  'js/call.js', 'js/theme.js', 'js/fullscreen.js', 'js/report.js', 'js/views/report.js', 'js/prayer.js', 'js/duas.js', 'icons/icon-512.png', 'icons/wordmark-light.svg', 'icons/wordmark-dark.svg',
  'js/views/today.js', 'js/views/mushaf.js', 'js/views/recite.js', 'js/views/adhkar.js', 'js/views/history.js',
  'js/views/teacher.js', 'js/views/settings.js', 'js/views/words.js', 'js/views/call.js', 'js/views/prayer.js',
  'js/views/duas.js', 'js/views/more.js', 'js/clean.js', 'js/views/admin.js', 'js/views/apply.js', 'js/views/parents.js', 'js/passplan.js',
];

self.addEventListener('install', (e) => {
  // Cache each file on its own, so one missing file cannot stop the update.
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== 'rwm-data').map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // The private decks area is never cached on the device.
  if (url.origin === location.origin && url.pathname.startsWith('/decks')) return;
  // Quran text and fonts: cache first, refresh in the background.
  if (url.hostname === 'api.alquran.cloud' || url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'esm.sh' || url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    e.respondWith(caches.open('rwm-data').then(async (c) => {
      const hit = await c.match(e.request);
      const net = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  // App files: network first so updates arrive (with a short timeout on weak connections), cache when offline.
  // Never cache sign-in redirects (?code=) or error responses.
  if (url.origin === location.origin) {
    const cacheable = !url.search.includes('code=') && !url.search.includes('error=');
    const isPage = e.request.mode === 'navigate';
    e.respondWith((async () => {
      const cached = await caches.match(e.request, { ignoreSearch: isPage });
      const net = fetch(e.request).then((r) => {
        if (r.ok && cacheable) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
        return r;
      });
      net.catch(() => {});
      const timeout = new Promise((res) => setTimeout(() => res(null), cached ? 4000 : 15000));
      try {
        const r = await Promise.race([net, timeout]);
        if (r) return r;
        return cached || await net;
      } catch {
        if (cached) return cached;
        if (isPage) return (await caches.match('index.html')) || Response.error();
        return Response.error();
      }
    })());
  }
});
