const version = '20200420';

const resourceList = [
  './css/normalize-8.0.1.css',
  './css/dark.css',
  './css/light.css',
  './css/icons.css',
  './css/main.css',
  './css/input.css',
  './css/listpage.css',
  './css/readpage.css',
  './css/configpage.css',
  './css/index.css',
  './css/icons.svg',
  './css/icons.woff',
  './data/s2t.json',
  './data/t2s.json',
  './js/touch.js',
  './js/range.js',
  './js/color.js',
  './js/onresize.js',
  './js/storage.js',
  './js/dom.js',
  './js/template.js',
  './js/itemlist.js',
  './js/text.js',
  './js/file.js',
  './js/config.js',
  './js/options.js',
  './js/speech.js',
  './js/page.js',
  './js/router.js',
  './js/main.js',
  './js/i18n.js',
  './js/i18n/en.js',
  './js/i18n/zh_cn.js',
  './js/listpage.js',
  './js/readpage.js',
  './js/configpage.js',
  './js/mainpage.js',
  './manifest.webmanifest',
  './reader.png',
  './reader.svg',
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

