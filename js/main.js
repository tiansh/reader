/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import config from './data/config.js';
import i18n from './i18n/i18n.js';
import Router from './page/router.js';
import ListPage from './page/list/listpage.js';
import ReadPage from './page/read/readpage.js';
import ConfigPage from './page/config/configpage.js';
import './page/common.js';

const router = (async function () {
  const locale = await config.get('locale', 'auto');
  if (locale !== 'auto') i18n.setLocale(locale);
  Array.from(document.querySelectorAll('[data-i18n]')).forEach(element => {
    element.textContent = i18n.getMessage(element.dataset.i18n, ...element.children);
  });
  document.documentElement.lang = i18n.getMessage('locale');
}()).then(() => {
  const router = new Router({
    list: new ListPage(),
    read: new ReadPage(),
    config: new ConfigPage(),
  }, '/');
  return router;
});

window.addEventListener('load', () => {
  ; (async function () {
    if (navigator.onLine === false) return;
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.register('./sw.js');
      reg.update();
    }
  }()).catch(() => {
    // Service Worker may be rejected due to not supported, privacy setting, ect.
  });
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', async event => {
    if (event.data.action === 'import') {
      /** @type {ListPage} */
      const page = await (await router).go('list');
      await page.importFile(event.data.file);
    }
  });
}

