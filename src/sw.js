const version = '20200319';

const resourceList = [
  './css/icons.css',
  './css/icons.svg',
  './css/icons.woff',
  './css/dark.css',
  './css/light.css',
  './css/main.css',
  './css/normalize-8.0.1.css',
  './js/storage.js',
  './js/config.js',
  './js/text.js',
  './js/file.js',
  './js/main.js',
  './js/touch.js',
  './js/onresize.js',
  './js/page.js',
  './js/router.js',
  './js/readpage.js',
  './js/listpage.js',
  './js/configpage.js',
  './js/mainpage.js',
  './data/s2t.json',
  './data/t2s.json',
  './manifest.webmanifest',
  './reader.png',
  './reader.svg',
  './sw.js',
  './favicon.ico',
  './index.html',
  './',
];

const cacheKey = `page-cache-${version}`;

self.addEventListener('install', function (event) {
  const cacheFiles = async function () {
    const cache = await caches.open(cacheKey);
    await cache.addAll(resourceList);
  };
  event.waitUntil(cacheFiles());
});

self.addEventListener('fetch', function (event) {
  const serveFile = async function (request) {
    const response = await caches.matches(request);
    return response;
  };
  event.respondWith(caches.match(event.request));
});

self.addEventListener('activate', event => {
  const deleteOutdateCache = async function () {
    const keys = await caches.keys();
    keys.map(key => {
      if (key !== cacheKey) caches.delete(key);
    });
  };
  event.waitUntil(deleteOutdateCache());
});

