/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

const onResize = {};

export default onResize;

/** @typedef {[number, number]} PageSize */
/** @typedef {(size: PageSize) => any} ResizeListener */

/** @type {ResizeListener[]} */
const listeners = [];

onResize.addListener = function (/** @type {ResizeListener} */listener) {
  const pos = listeners.indexOf(listener);
  if (pos !== -1) return null;
  listeners.push(listener);
  const [width, height] = onResize.currentSize();
  if (width && height) listener([width, height]);
  return listener;
};

onResize.removeListener = function (/** @type {ResizeListener} */listener) {
  const pos = listeners.indexOf(listener);
  if (pos === -1) return false;
  listeners.splice(pos, 1);
  return true;
};

/** @type {PageSize[0]} */
let lastWidth = null;
/** @type {PageSize[1]} */
let lastHeight = null;

/** @type {boolean} */
let scheduled = false;
const updateSize = (function () {
  const adjustSize = function (size) {
    listeners.forEach(listener => { listener(size); });
  };
  return function () {
    if (scheduled) return;
    const html = document.documentElement;
    const [width, height] = [html.clientWidth, html.clientHeight];
    if (width === lastWidth && height === lastHeight) return;
    scheduled = true;
    window.requestAnimationFrame(function () {
      scheduled = false;
      const [width, height] = [html.clientWidth, html.clientHeight];
      [lastWidth, lastHeight] = [width, height];
      adjustSize([width, height]);
      window.requestAnimationFrame(updateSize);
    });
  };
}());

updateSize();
window.addEventListener('load', updateSize);
window.addEventListener('resize', updateSize);
window.addEventListener('orientationchange', updateSize);
document.addEventListener('visibilitychange', updateSize);

/** @returns {PageSize} */
onResize.currentSize = function () {
  return [lastWidth, lastHeight];
};

onResize.isCurrentSizeDirty = function () {
  return scheduled;
};

