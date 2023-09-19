/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

const version = /* VERSION */"20230919"/* VERSION */; // eslint-disable-line quotes

const resourceList = [
  './help/about.html',
  './help/credits.html',
  './help/en.html',
  './help/zh_cn.html',
  './help/privacy.html',
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
  './css/page/scrollreadpage.css',
  './css/index.css',
  './css/normalize-8.0.1.css',
  './data/han/s2t.json',
  './data/han/t2s.json',
  './js/data/app.js',
  './js/data/config.js',
  './js/data/file.js',
  './js/data/options.js',
  './js/data/storage.js',
  './js/i18n/i18n.js',
  './js/i18n/locale/en.js',
  './js/i18n/locale/zh_cn.js',
  './js/i18n/locale/zh_tw.js',
  './js/ui/component/color.js',
  './js/ui/component/itemlist.js',
  './js/ui/component/menu.js',
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
  './js/page/read/index/readindex.js',
  './js/page/read/index/bookmarkpage.js',
  './js/page/read/index/contentspage.js',
  './js/page/read/index/indexpage.js',
  './js/page/read/index/indexsubpage.js',
  './js/page/read/index/searchpage.js',
  './js/page/read/jump/jumppage.js',
  './js/page/read/speech/readspeech.js',
  './js/page/read/text/fliptextpage.js',
  './js/page/read/text/scrolltextpage.js',
  './js/page/read/text/textpage.js',
  './js/page/read/readpage.js',
  './js/page/read/readsubpage.js',
  './js/page/common.js',
  './js/page/router.js',
  './js/page/page.js',
  './js/main.js',
  './js/lib/pako@2.1.0/pako_inflate.min.js',
  './icon/icon.png',
  './icon/icon.svg',
  './icon/icon.ico',
  './icon/maskable.png',
  './icon/monochrome.png',
  './manifest.webmanifest',
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
  const url = new URL(event.request.url);
  if (event.request.method === 'GET') {
    if (url.href === new URL('?version', location.href).href) {
      const versionText = `/* VERSION */${JSON.stringify(version)}/* VERSION */`;
      const init = { status: 200, headers: { 'Content-Type': 'text/plain' } };
      event.respondWith(new Response(versionText, init));
    } else {
      event.respondWith(caches.match(event.request));
    }
    return;
  } else if (event.request.method === 'POST') {
    if (url.pathname === new URL('./import', location.href).pathname) {
      event.respondWith(Response.redirect(new URL('./#!/', location.href)));
      event.waitUntil(event.request.formData().then(async formData => {
        const file = formData.get('text');
        const client = await self.clients.get(event.resultingClientId);
        client.postMessage({ action: 'import', file });
      }));
      return;
    }
  }
  event.respondWith(Response.error());
});

