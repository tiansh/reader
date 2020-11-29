/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

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
    if (element.getAttribute('tabindex') !== '-1') return;
    if (!map.has(element)) return;
    const tabindex = map.get(element);
    if (tabindex == null) element.removeAttribute('tabindex');
    else element.setAttribute('tabindex', tabindex);
    map.delete(element);
  });
};

