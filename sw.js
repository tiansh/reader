const resourceList = [
  './css/dark.css',
  './css/icons.css',
  './css/icons.svg',
  './css/icons.woff',
  './css/main.css',
  './css/normalize-8.0.1.css',
  './js/config.js',
  './js/file.js',
  './js/listpage.js',
  './js/main.js',
  './js/mainpage.js',
  './js/onresize.js',
  './js/page.js',
  './js/readpage.js',
  './js/router.js',
  './js/storage.js',
  './js/text.js',
  './js/touch.js',
  './manifest.webmanifest',
  './reader.png',
  './reader.svg',
  './sw.js',
  './favicon.ico',
  './index.html',
  './',
];

self.addEventListener('install', function (event) {
  console.log('install!');
  const cacheFiles = async function () {
    const cache = await caches.open('page-cache');
    await cache.addAll(resourceList);
    console.log('cache?!');
  };
  event.waitUntil(cacheFiles());
});

self.addEventListener('fetch', function (event) {
  console.log('fetch');
  const serveFile = async function (request) {
    const response = await caches.matches(request);
    console.log('response');
    return response;
  };
  event.respondWith(caches.match(event.request));
});

self.addEventListener('activate', event => {
  console.log('activate');
  const enableNavigationPreload = async function () {
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
      console.log('enable');
    }
  };
  event.waitUntil(enableNavigationPreload());
});

