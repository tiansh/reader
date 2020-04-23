const dom = {};

export default dom;

/** @type {WeakMap<HTMLElement, WeakMap<HTMLElement, string>>} */
const focusMemory = new WeakMap();

/**
 * @param {HTMLElement} element
 */
dom.disableKeyboardFocus = function (element) {
  if (!focusMemory.has(element)) focusMemory.set(element, new WeakMap());
  const map = focusMemory.get(element);
  const elements = Array.from(element.querySelectorAll('input, select, textarea, button, object, a[href], [tabindex]'));
  elements.forEach(element => {
    const tabindex = element.getAttribute('tabindex');
    if (tabindex === '-1') return;
    map.set(element, tabindex);
    element.setAttribute('tabindex', '-1');
  });
};

/**
 * @param {HTMLElement} element
 */
dom.enableKeyboardFocus = function (element) {
  if (!focusMemory.has(element)) return;
  const map = focusMemory.get(element);
  focusMemory.delete(element);
  const elements = Array.from(element.querySelectorAll('input, select, textarea, button, object, a[href], [tabindex]'));
  elements.forEach(element => {
    if (!map.has(element)) return;
    const tabindex = map.get(element);
    if (tabindex == null) element.removeAttribute('tabindex');
    else element.setAttribute('tabindex', tabindex);
    map.delete(element);
  });
};

