/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import onResize from './onresize.js';
import config from './config.js';
import i18n from './i18n.js';
import theme from './theme.js';

onResize.addListener(([width, height]) => {
  const html = document.documentElement;
  html.style.setProperty('--window-width', width + 'px');
  html.style.setProperty('--window-height', height + 'px');
});

document.body.addEventListener('touchmove', function (event) {
  const target = event.target;
  do {
    if (!(target instanceof Element)) break;
    if (!target.matches('.scroll, .scroll *')) break;
    if (document.body.classList.contains('noscroll')) break;
    return;
  } while (false);
  event.preventDefault();
}, { passive: false, useCapture: false });

Array.from(document.querySelectorAll('[data-i18n]')).forEach(element => {
  element.textContent = i18n.getMessage(element.dataset.i18n, ...element.children);
});

const updateTheme = function () {
  const root = document.documentElement;
  const isLight = theme.getCurrent() === 'light';
  root.classList.add(isLight ? 'light-theme' : 'dark-theme');
  root.classList.remove(isLight ? 'dark-theme' : 'light-theme');
};
theme.addChangeListener(updateTheme);
updateTheme();
