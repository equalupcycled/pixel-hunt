// Pixel Hunt service worker.
// Network-first for the page, JS, CSS and manifest (so a new deploy reaches phones immediately and a
// stale/broken copy can never get stuck); cache is only the offline fallback. Images are cache-first.
const CACHE = 'pixelhunt-v9';
const ASSETS = ['./', './index.html', './css/style.css', './js/tap.js', './js/audio.js', './js/ads.js', './js/economy.js', './js/meta.js', './js/leaderboard.js', './js/share.js', './js/game.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/share-banner.png'];
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(a => c.add(new Request(a, { cache: 'reload' })).catch(() => {})))));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const isImg = /\.(png|jpe?g|gif|webp|svg|ico)$/i.test(url.pathname);
  const put = res => { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; };
  if (isImg) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(put)));
    return;
  }
  e.respondWith(fetch(req, { cache: 'no-cache' }).then(put).catch(() =>
    caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
