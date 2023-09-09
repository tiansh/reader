/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import { TouchGestureListener } from '../util/touch.js';
import template from '../util/template.js';
import i18n from '../../i18n/i18n.js';

/**
 * @template {any} ListItemType
 */
export default class ItemList {
  /**
   * @param {HTMLElement} container
   * @param {{
   *   list: ListItemType[],
   *   selectable: boolean,
   *   mayRemove: (item: ListItemType, index: number) => boolean,
   *   onRemove: (item: ListItemType, index: number) => any,
   *   onItemClick: (item: ListItemType, index: number) => any,
   *   render: (container: HTMLElement, item: ListItemType, index: number) => any,
   *   emptyListRender: () => HTMLElement,
   * }} config
   */
  constructor(container, config) {
    this.container = container;
    this.render = config.render;
    this.list = config.list;
    /** @type {Map<number, HTMLElement>} */
    this.elements = new Map();

    this.hasClick = typeof config.onItemClick === 'function' || this.selectable;
    this.hasRemove = typeof config.onRemove === 'function';

    this.onItemClick = config.onItemClick;
    this.onRemove = config.onRemove;
    this.mayRemove = config.mayRemove ?? (() => true);
    this.selectable = config.selectable;
    /** @type {Set<number>} */
    this.selected = new Set();
    this.emptyListRender = config.emptyListRender;

    this.listElement = this.container.appendChild(document.createElement('ul'));
    this.listElement.classList.add('item-list');
    if (this.selectable) {
      this.listElement.classList.add('item-list-selectable');
      this.listElement.setAttribute('role', 'listbox');
    }
    if (this.emptyListRender) {
      this.emptyItem = document.createElement('li');
      this.emptyItem.classList.add('list-item', 'list-item-empty');
      this.emptyListRender(this.emptyItem);
    }
    this.renderList();

    const getEventIndex = event => {
      const target = event.target;
      if (!(event.target instanceof HTMLElement)) return null;
      const button = target.closest('.list-item-container');
      if (!button) return null;
      const content = button.querySelector('.list-item-content-wrap');
      const index = this.list.findIndex((item, index) => this.elements.get(index) === content);
      if (index === -1) return null;
      return index;
    };

    if (typeof this.onItemClick === 'function') {
      this.listElement.addEventListener('click', event => {
        if (this.hasRemove) {
          this.listElement.dispatchEvent(new Event('__hide_remove'));
        }
        const index = getEventIndex(event);
        if (index === null) return;
        const item = this.list[index];
        this.onItemClick(item, index);
      });
    }

    if (this.hasRemove) {
      this.listElement.addEventListener('contextmenu', event => {
        const index = getEventIndex(event);
        if (index === null) return;
        const li = this.elements.get(index).closest('.list-item');
        if (li.classList.contains('list-item-show-remove')) {
          const deleteEvent = new KeyboardEvent('keydown', { code: 'Escape' });
          li.dispatchEvent(deleteEvent);
        } else {
          const deleteEvent = new KeyboardEvent('keydown', { code: 'Delete' });
          li.dispatchEvent(deleteEvent);
        }
        event.preventDefault();
      });
    }

    this.listElement.addEventListener('scroll', event => {
      if (this.listElement.scrollLeft !== 0) {
        this.listElement.scrollLeft = 0;
      }
    });
  }
  renderItem(item, index) {
    const li = document.createElement('li');
    li.classList.add('list-item');
    const type = this.hasClick ? 'button' : 'div';
    const container = li.appendChild(document.createElement(type));
    if (this.hasClick) container.type = 'button';
    container.classList.add('list-item-container');
    container.dataset.listIndex = index;
    if (this.selectable) {
      const icon = container.appendChild(template.icon('checkmark'));
      icon.classList.add('list-item-selected-icon');
      container.setAttribute('role', 'option');
      container.setAttribute('aria-selected', 'false');
    }
    const content = container.appendChild(document.createElement('div'));
    content.classList.add('list-item-content-wrap');
    content.setAttribute('tabindex', '-1');
    this.render(content, item, index);
    this.elements.set(index, content);
    if (this.hasRemove && this.mayRemove(item, index)) {
      li.classList.add('list-item-has-remove');

      const removeRef = template.create('listRemoveAction');
      const removeButton = removeRef.get('button');
      removeButton.addEventListener('click', () => {
        const index = this.list.indexOf(item);
        if (index !== -1) this.onRemove(item, index);
      });
      removeButton.setAttribute('aria-label', i18n.getMessage('buttonRemove'));
      li.appendChild(removeRef.get('root'));

      const maxSlide = 120, overSlide = 20;
      let showDelete = false, showDeleteMove = false;
      const slideDelete = (action, offset) => {
        if (action === 'move') {
          li.classList.add('list-item-slide-remove');
          document.body.classList.add('noscroll');
          const off = showDelete ? offset - maxSlide : offset;
          const move = Math.min(0, Math.max(-maxSlide - overSlide, off));
          li.style.left = move + 'px';
          showDeleteMove = true;
          this.listElement.dispatchEvent(new Event('__hide_remove'));
        } else {
          li.classList.remove('list-item-slide-remove');
          document.body.classList.remove('noscroll');
          window.requestAnimationFrame(() => {
            if (action === 'show') {
              showDelete = true;
              li.style.left = -maxSlide + 'px';
              li.classList.add('list-item-show-remove');
            } else if (action === 'hide') {
              showDelete = false;
              li.style.left = '0px';
              li.classList.remove('list-item-show-remove');
            }
            li.scrollLeft = 0;
          });
          showDeleteMove = false;
        }
      };
      const listener = new TouchGestureListener(li);
      listener.onMoveX(offset => { slideDelete('move', offset); });
      listener.onSlideLeft(() => { slideDelete('show'); });
      listener.onSlideRight(() => { slideDelete('hide'); });
      listener.onCancelX(() => { slideDelete('cancel'); });

      this.listElement.addEventListener('__hide_remove', () => {
        if (showDelete && !showDeleteMove) slideDelete('hide');
      });

      li.addEventListener('keydown', event => {
        if (['Delete', 'ArrowLeft'].includes(event.code)) {
          this.listElement.dispatchEvent(new Event('__hide_remove'));
          if (!showDelete) slideDelete('show');
          else {
            const index = this.list.indexOf(item);
            this.onRemove(item, index);
          }
        } else if (['Enter', 'Space', 'Escape', 'ArrowRight'].includes(event.code)) {
          if (showDelete) {
            slideDelete('hide');
          }
        }
      });

      removeButton.addEventListener('focus', event => {
        slideDelete('show');
      });
      removeButton.addEventListener('blur', event => {
        slideDelete('hide');
      });

    }
    return li;
  }
  renderList() {
    this.listElement.innerHTML = '';
    if (this.emptyItem) this.listElement.appendChild(this.emptyItem);
    this.elements.clear();
    this.selected.clear();
    this.list.forEach((item, index) => {
      const li = this.renderItem(item, index);
      this.listElement.appendChild(li);
    });
  }
  dispatch() {
    this.clearList();
    this.listElement.remove();
  }
  isListEmpty() {
    return this.list.length === 0;
  }
  clearList() {
    this.list.splice(0);
    this.renderList();
  }
  setList(list) {
    this.list.splice(0, this.list.length, ...list);
    this.renderList();
  }
  appendList(list) {
    const lastSize = this.list.length;
    this.list.push(...list);
    list.forEach((item, index) => {
      const li = this.renderItem(item, lastSize + index);
      this.listElement.appendChild(li);
    });
  }
  getList() {
    return [...this.list];
  }
  setItem(item, index) {
    if (index < this.list.length) {
      this.list.splice(index, 1, item);
      this.render(this.elements.get(index), item, index);
    } else if (index === this.list.length) {
      this.list.push(item);
      const li = this.renderItem(item, index);
      this.listElement.appendChild(li);
    }
  }
  getItem(index) {
    return this.list[index];
  }
  getItemElement(index) {
    return this.elements.get(index);
  }
  listAllSelected(index) {
    return Array.from(this.selected);
  }
  setSelectItem(index, selected) {
    if (!this.selectable) return;
    const element = this.elements.get(index);
    const li = element.closest('.list-item');
    const container = li.querySelector('.list-item-container');
    if (selected) {
      li.classList.add('list-item-selected');
      container.setAttribute('aria-selected', 'true');
      this.selected.add(index);
    } else {
      li.classList.remove('list-item-selected');
      container.setAttribute('aria-selected', 'false');
      this.selected.delete(index);
    }
  }
  /**
   * @param {number} index
   * @param {ScrollIntoViewOptions} options
   */
  scrollIntoView(index, options) {
    const element = this.elements.get(index);
    element.scrollIntoView(options ?? { block: 'nearest' });
  }
  clearSelectItem() {
    if (!this.selectable) return;
    Array.from(this.selected).forEach(n => this.setSelectItem(n, false));
  }
  getSelectItems() {
    if (!this.selectable) return null;
    return Array.from(this.selected).map(n => this.list[n]);
  }
  renderRemoveItem(element) {
    element.setAttribute('aria-hidden', 'true');
    element.classList.add('list-item-remove-ani');
    element.style.height = element.clientHeight + 'px';
    window.requestAnimationFrame(() => {
      element.style.height = '0';
      setTimeout(() => {
        element.remove();
      }, 200);
    });
  }
  indexMapping(f) {
    const newElements = new Map();
    this.elements.forEach((value, i) => {
      const r = f(i);
      if (r == null) return;
      newElements.set(r, value);
    });
    this.elements = newElements;

    const newSelected = new Set();
    this.selected.forEach(i => {
      const r = f(i);
      if (r == null) return;
      newSelected.add(r);
    });
    this.selected = newSelected;
  }
  removeItem(index) {
    this.list.splice(index, 1);
    const element = this.elements.get(index).closest('.list-item');
    this.renderRemoveItem(element);

    this.indexMapping(i => i === index ? null : i - (i > index));

    this.focusItemContent(index);
  }
  insertItem(item, index) {
    if (index < 0 || index > this.list.length) return;
    this.list.splice(index, 0, item);
    const next = this.elements.get(index).closest('.list-item');
    this.indexMapping(i => i + (i >= index));
    const li = this.renderItem(item, index);
    next.parentNode.insertBefore(li, next);
  }
  focusItemContent(index) {
    if (!this.list.length) return;
    const element = this.elements.get(Math.min(index, this.list.length - 1));
    element.focus();
  }
}

