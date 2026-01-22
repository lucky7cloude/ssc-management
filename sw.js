
const CACHE_NAME = 'silver-star-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  'https://img.sanishtech.com/u/cf1c483bc2936b95b1af2353b0c49246.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
