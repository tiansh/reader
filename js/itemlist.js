import { TouchGestureListener } from './touch.js';
import template from './template.js';

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
    this.mayRemove = config.mayRemove || (() => true);
    this.selectable = config.selectable;
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

    if (typeof this.onItemClick === 'function') {
      this.listElement.addEventListener('click', event => {
        if (this.hasRemove) {
          this.listElement.dispatchEvent(new Event('__hide_remove'));
        }
        const target = event.target;
        if (!(event.target instanceof HTMLElement)) return;
        const button = target.closest('.list-item-container');
        if (!button) return;
        const content = button.querySelector('.list-item-content-wrap');
        const index = this.list.findIndex((item, index) => this.elements.get(index) === content);
        if (index === -1) return;
        const item = this.list[index];
        this.onItemClick(item, index);
      });
    }
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
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
    }
    const content = container.appendChild(document.createElement('div'));
    content.classList.add('list-item-content-wrap');
    content.setAttribute('tabindex', '-1');
    this.render(content, item, index);
    this.elements.set(index, content);
    if (this.hasRemove && this.mayRemove(item, index)) {
      li.classList.add('list-item-has-remove');

      const [removeAction, removeRef] = template.create('list_remove_action');
      removeRef.get('button').addEventListener('click', () => {
        const index = this.list.indexOf(item);
        if (index !== -1) this.onRemove(item, index);
      });
      li.appendChild(removeAction);

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
            if (action === 'show') showDelete = true;
            if (action === 'hide') showDelete = false;
            li.style.left = (showDelete ? -maxSlide : 0) + 'px';
          });
          showDeleteMove = false;
        }
      };
      const listener = new TouchGestureListener(li, { clickParts: 1 });
      listener.onMoveX(offset => { slideDelete('move', offset); });
      listener.onSlideLeft(() => { slideDelete('show'); });
      listener.onSlideRight(() => { slideDelete('hide'); });
      listener.onCancelX(() => { slideDelete('cancel'); });

      this.listElement.addEventListener('__hide_remove', () => {
        if (showDelete && !showDeleteMove) slideDelete('hide');
      });

      li.addEventListener('keydown', event => {
        if (['Delete', 'ArrowLeft'].includes(event.code)) {
          if (!this.showDelete) slideDelete('show');
          else this.onRemove(item, index);
        }
        if (['Enter', 'Space', 'Escape', 'ArrowRight'].includes(event.code)) {
          if (this.showDelete) {
            slideDelete('hide');
          }
        }
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
  clearList() {
    this.list.splice(0);
    this.renderList();
  }
  setList(list) {
    this.clearList();
    this.list.push(...list);
    this.renderList();
  }
  setItem(item, index) {
    if (index < this.list.length) {
      this.list.splice(index, 1, item);
      this.render(this.elements.get(index), item, index);
    } else {
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
  setSelectItem(index, selected) {
    if (!this.selectable) return;
    const element = this.elements.get(index);
    const container = element.closest('.list-item');
    if (selected) {
      container.classList.add('list-item-selected');
      container.setAttribute('aria-selected', 'true');
      this.selected.add(index);
    } else {
      container.classList.remove('list-item-selected');
      container.setAttribute('aria-selected', 'false');
      this.selected.delete(index);
    }
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
  }
  insertItem(item, index) {
    if (index < 0 || index > this.list.length) return;
    this.list.splice(index, 0, item);
    const next = this.elements.get(index).closest('.list-item');
    this.indexMapping(i => i + (i >= index));
    const li = this.renderItem(item, index);
    next.parentNode.insertBefore(li, next);
  }
}

