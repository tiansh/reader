/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import onResize from '../ui/util/onresize.js';
import i18n from '../i18n/i18n.js';
import theme from '../theme/theme.js';

onResize.addListener(([width, height]) => {
  const html = document.documentElement;
  html.style.setProperty('--window-width', width + 'px');
  html.style.setProperty('--window-height', height + 'px');
});

// Only add .hover className when user use a mouse
// mouseover will sometime not triggered after touchstart
let inTouch = false;
document.documentElement.addEventListener('touchstart', function (event) {
  inTouch = true;
}, { passive: true, useCapture: false });
document.documentElement.addEventListener('mousemove', function (event) {
  inTouch = false;
}, { passive: true, useCapture: false });
document.documentElement.addEventListener('mouseover', function (event) {
  const button = event.target.closest('button');
  if (button && !inTouch) button.classList.add('hover');
}, { passive: true, useCapture: false });
document.documentElement.addEventListener('mouseout', function (event) {
  const button = event.target.closest('button');
  if (button) button.classList.remove('hover');
}, { passive: true, useCapture: false });

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

