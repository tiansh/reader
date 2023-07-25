/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import dom from '../util/dom.js';
import template from '../util/template.js';

/**
 * @template ValueType
 * @typedef {object} MenuItem
 * @property {string} title
 * @property {ValueType} value
 */

/**
 * @template ValueType
 */
export default class Menu {
  /**
   * @param {MenuItem<ValueType>[][]} groups
   */
  constructor({ groups }) {
    this.pageElement = document.getElementById('pages');
    this.menuElement = document.getElementById('screen_menu');
    this.optionContainerElement = this.menuElement.querySelector('.screen-option');

    this.groups = groups;

    this.keyboardHandler = this.keyboardHandler.bind(this);
    this.clickHandler = this.clickHandler.bind(this);
    this.buttonClickHandler = this.buttonClickHandler.bind(this);
  }
  /** @param {KeyboardEvent} event */
  keyboardHandler(event) {
    if (event.code === 'Escape') {
      this.resolve();
    } else if (['ArrowUp', 'ArrowDown'].includes(event.code)) {
      const current = document.activeElement;
      const buttons = [...this.bindingValue.keys()];
      const index = buttons.indexOf(current);
      const next = event.code === 'ArrowUp' ?
        index !== -1 ? index - 1 : buttons.length - 1 :
        index !== -1 ? index + 1 : 0;
      if (0 <= next && next < buttons.length) {
        buttons[next].focus();
      }
    } else if (event.code === 'Home') {
      [...this.bindingValue.keys()].shift().focus();
    } else if (event.code === 'End') {
      [...this.bindingValue.keys()].pop().focus();
    }
  }
  /** @param {MouseEvent} event */
  clickHandler(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const item = target.closest('.screen-option-item');
    const value = this.bindingValue.get(item);
    this.resolve(value);
  }
  renderMenu() {
    /** @type {Map<HTMLElement, ValueType>} */
    this.bindingValue = new Map();
    this.groups.forEach(group => {
      const groupElement = template.create('menugroup').get('root');
      group.map(item => {
        const itemRef = template.create('menuitem');
        itemRef.get('text').textContent = item.title;
        const itemElement = itemRef.get('root');
        this.bindingValue.set(itemElement, item.value);
        groupElement.appendChild(itemElement);
      });
      this.optionContainerElement.appendChild(groupElement);
    });
  }
  cleanMenu() {
    this.optionContainerElement.innerHTML = '';
    this.bindingValue = null;
  }
  hideMenu() {
    this.menuElement.classList.remove('screen-menu-active');
    this.pageElement.setAttribute('aria-hidden', 'false');
    dom.enableKeyboardFocus(this.pageElement);
    document.removeEventListener('keydown', this.keyboardHandler);
    this.menuElement.removeEventListener('click', this.clickHandler);
  }
  showMenu() {
    this.menuElement.classList.add('screen-menu-active');
    this.pageElement.setAttribute('aria-hidden', 'true');
    dom.disableKeyboardFocus(this.pageElement);
    document.addEventListener('keydown', this.keyboardHandler);
    this.menuElement.addEventListener('click', this.clickHandler);
  }
  focusMenu() {
    this.menuElement.querySelector('button').focus();
  }
  open() {
    if (Menu.activeMenu) return false;
    Menu.activeMenu = this;
    const response = new Promise(resolve => {
      this.resolve = resolve;
    });
    response.then(() => {
      this.resolve = null;
      Menu.activeMenu = null;
      this.cleanMenu();
      this.hideMenu();
    });
    this.renderMenu();
    this.showMenu();
    return response;
  }
  buttonClickHandler() {
    const activeBefore = document.activeElement === this.button;
    const response = this.open();
    if (activeBefore) this.focusMenu();
    response.then(value => {
      if (activeBefore) this.button.focus();
      this.callback(value);
    });
  }
  /**
   * @param {HTMLElement} button
   * @param {(response: ValueType) => any} callback
   */
  bind(button, callback) {
    if (this.button) return false;
    this.button = button;
    this.callback = callback;
    this.button.addEventListener('click', this.buttonClickHandler);
    return true;
  }
  unbind() {
    this.button.removeEventListener('click', this.buttonClickHandler);
    this.button = null;
    this.callback = null;
  }
}

