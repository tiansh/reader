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

const updateSize = (function () {
  let scheduled = false;
  const adjustSize = function (size) {
    listeners.forEach(listener => { listener(size); });
  };
  return function () {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(function () {
      const [width, height] = [window.innerWidth, window.innerHeight];
      if (width !== lastWidth || height !== lastHeight) {
        adjustSize([width, height]);
        lastWidth = width;
        lastHeight = height;
      }
      scheduled = false;
    });
  };
}());

updateSize();
window.addEventListener('load', updateSize);
window.addEventListener('resize', updateSize);
window.addEventListener('orientationchange', updateSize);

/** @returns {PageSize} */
onResize.currentSize = function () {
  return [lastWidth, lastHeight];
};

