/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import Router from './page/router.js';
import ListPage from './page/list/listpage.js';
import ReadPage from './page/read/readpage.js';
import ConfigPage from './page/config/configpage.js';
import './page/common.js';

const router = new Router({
  list: new ListPage(),
  read: new ReadPage(),
  config: new ConfigPage(),
}, '/');

; (async function () {
  if (navigator.onLine === false) return;
  if ('serviceWorker' in navigator) {
    await navigator.serviceWorker.register('./sw.js');
  }
}());

