/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

const template = {};

/** @type {Map<string, HTMLTemplateElement>} */
const allTemplates = new Map();
Array.from(document.querySelectorAll('template[id]')).forEach(template => {
  allTemplates.set(template.id, template);
  template.remove();
});

export default template;

/**
 * @param {string} id
 * @returns {Map<string, HTMLElement>}
 */
template.create = function (name) {
  const id = name.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
  const template = allTemplates.get(id);
  /** @type {DocumentFragment} */
  const content = template.content.cloneNode(true);
  const result = content.firstElementChild;
  const reference = new Map();
  Array.from(result.querySelectorAll('[data-ref]')).forEach(ref => {
    reference.set(ref.dataset.ref, ref);
    ref.removeAttribute('data-ref');
  });
  reference.set('root', result);
  return reference;
};

template.icon = function (type, title = null) {
  const icon = template.create('icon').get('root');
  icon.classList.add('icon-' + type);
  if (title) {
    icon.setAttribute('title', title);
    icon.setAttribute('aria-label', title);
  } else {
    icon.setAttribute('aria-hidden', 'true');
  }
  return icon;
};

/** @returns {HTMLButtonElement} */
template.iconButton = function (type, title = null) {
  const button = template.create('iconButton');
  const icon = template.icon(type, title);
  button.get('icon').appendChild(icon);
  return button.get('root');
};

