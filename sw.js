/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

const version = '20201129';

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
  './js/theme.js',
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
  './credits.html',
  './',
];

const cacheKey = `page-cache-${version}`;

const cacheFiles = async function () {
  const cache = await caches.open(cacheKey);
  await cache.addAll(resourceList);
  const keys = await caches.keys();
  await Promise.all(keys.map(async key => {
    if (key === cacheKey) return;
    await caches.delete(key);
  }));
};

self.addEventListener('install', function (event) {
  event.waitUntil(cacheFiles());
});

self.addEventListener('fetch', function (event) {
  event.respondWith(caches.match(event.request));
});

