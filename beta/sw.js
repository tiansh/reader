/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

const version = '2021082102';

const resourceList = [
  './css/common/input.css',
  './css/common/main.css',
  './css/icons/icons.css',
  './css/icons/icons.svg',
  './css/icons/icons.woff',
  './css/theme/dark.css',
  './css/theme/light.css',
  './css/page/configpage.css',
  './css/page/listpage.css',
  './css/page/readpage.css',
  './css/page/flipreadpage.css',
  './css/index.css',
  './css/normalize-8.0.1.css',
  './data/han/s2t.json',
  './data/han/t2s.json',
  './js/data/config.js',
  './js/data/file.js',
  './js/data/options.js',
  './js/data/storage.js',
  './js/i18n/i18n.js',
  './js/i18n/locale/en.js',
  './js/i18n/locale/zh_cn.js',
  './js/ui/component/color.js',
  './js/ui/component/itemlist.js',
  './js/ui/component/range.js',
  './js/ui/util/dom.js',
  './js/ui/util/onresize.js',
  './js/ui/util/template.js',
  './js/ui/util/touch.js',
  './js/text/speech.js',
  './js/text/text.js',
  './js/theme/theme.js',
  './js/page/config/configpage.js',
  './js/page/list/listpage.js',
  './js/page/read/control/controlpage.js',
  './js/page/read/index/bookmarkpage.js',
  './js/page/read/index/contentspage.js',
  './js/page/read/index/indexpage.js',
  './js/page/read/index/indexsubpage.js',
  './js/page/read/index/searchpage.js',
  './js/page/read/jump/jumppage.js',
  './js/page/read/speech/readspeech.js',
  './js/page/read/text/fliptextpage.js',
  './js/page/read/text/textpage.js',
  './js/page/read/readpage.js',
  './js/page/read/readsubpage.js',
  './js/page/common.js',
  './js/page/router.js',
  './js/page/page.js',
  './js/main.js',
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

