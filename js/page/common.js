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
import config from '../data/config.js';

const updateWindowSize = function ([width, height]) {
  const html = document.documentElement;
  html.style.setProperty('--window-width', width + 'px');
  html.style.setProperty('--window-height', height + 'px');
};
onResize.addListener(updateWindowSize);

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
  if (target instanceof Node) check: do {
    for (let ref = target; ref; ref = ref.parent) {
      if (ref instanceof Element) {
        if (ref.classList.contains('scroll')) return;
        if (ref.classList.contains('noscroll')) break check;
      }
    }
    return;
  } while (false);
  event.preventDefault();
}, { passive: false, useCapture: false });

; (function () {
  let oldClientY = null;
  document.addEventListener('touchstart', function (event) {
    oldClientY = event.touches.item(0).clientY;
  }, { passive: true });
  document.addEventListener('touchmove', function (event) {
    const touch = event.touches.item(0);
    const clientY = touch.clientY;
    const element = document.elementFromPoint(touch.screenX, touch.screenY);
    const scrollElement = element?.closest('.scroll');
    if (scrollElement) {
      const scrollTop = scrollElement.scrollTop;
      const maxScrollTop = scrollElement.scrollHeight - scrollElement.clientHeight;
      if (scrollTop <= 0 && clientY > oldClientY || scrollTop >= maxScrollTop && clientY < oldClientY) {
        event.preventDefault();
      }
    }
    oldClientY = clientY;
  }, { passive: false });
}());

const updateTheme = function () {
  const root = document.documentElement;
  const isLight = theme.getCurrent() === 'light';
  root.classList.add(isLight ? 'light-theme' : 'dark-theme');
  root.classList.remove(isLight ? 'dark-theme' : 'light-theme');
};
theme.addChangeListener(updateTheme);
updateTheme();

; (async function () {
  // EXPERT_CONFIG Add some custom CSS (danger)
  const userCustomCss = await config.expert('appearance.custom_css', 'string', '');
  document.getElementById('custom_css').textContent = userCustomCss;
}());

