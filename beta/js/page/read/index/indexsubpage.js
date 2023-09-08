/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import IndexPage from './indexpage.js';
import ReadSubPage from '../readsubpage.js';
import ReadPage from '../readpage.js';
import i18n from '../../../i18n/i18n.js';
import template from '../../../ui/util/template.js';
import dom from '../../../ui/util/dom.js';
import ItemList from '../../../ui/component/itemlist.js';

export default class IndexSubPage extends ReadSubPage {
  /**
   * @param {HTMLElement} container
   * @param {HTMLElement} tabItem
   * @param {number} index
   * @param {IndexPage} indexPage
   * @param {ReadPage} readPage
   */
  constructor(container, tabItem, index, indexPage, readPage) {
    super(container, readPage);
    this.isCurrent = false;
    this.isShow = false;
    this.tabItem = tabItem;
    this.pageIndex = index;
    this.indexPage = indexPage;
    this.tabGroup = this.tabItem.closest('.tab-group');
    this.pageButtonAction = this.pageButtonAction.bind(this);
  }
  updateListRender() {
    if (!this.itemList) return;
    if (this.isCurrent && this.isShow) {
      dom.enableKeyboardFocus(this.container);
    } else {
      dom.disableKeyboardFocus(this.container);
    }
  }
  setCurrent() {
    this.isCurrent = true;
    this.container.removeAttribute('aria-hidden');
    this.updateListRender();
  }
  unsetCurrent() {
    this.isCurrent = false;
    this.container.setAttribute('aria-hidden', 'true');
    this.updateListRender();
  }
  show() {
    this.isShow = true;
    this.updateListRender();
  }
  hide() {
    this.isShow = false;
    this.updateListRender();
  }
  /** @returns {HTMLButtonElement} */
  createPageButton() { }
  onFirstActivate() {
    super.onFirstActivate();

    const headerRef = template.create('header');
    this.headerElement = this.container.insertBefore(headerRef.get('root'), this.container.firstChild);
    const backButton = template.iconButton('back', i18n.getMessage('buttonBack'));
    this.backButton = headerRef.get('left').appendChild(backButton);
    this.pageButton = this.createPageButton();
    headerRef.get('right').appendChild(this.pageButton);

    this.tabItem.addEventListener('click', event => {
      this.indexPage.setCurrentSubPage(this);
    });
    this.backButton.addEventListener('click', event => {
      this.indexPage.hide();
    });
    this.container.addEventListener('keydown', event => {
      event.stopPropagation();
    });

    this.listElement = this.container.querySelector('.index-list');
  }
  onActivate() {
    const items = this.getListItems();
    const onItemClick = this.onItemClick.bind(this);
    const render = this.listItemRender.bind(this);
    const emptyListRender = this.emptyListRender.bind(this);
    const onRemove = this.onRemoveItem?.bind(this);
    this.itemList = new ItemList(this.listElement, {
      list: items.slice(0),
      onItemClick,
      render,
      selectable: true,
      emptyListRender,
      onRemove,
    });
    this.pageButton.addEventListener('click', this.pageButtonAction);
  }
  onInactivate() {
    this.itemList.dispatch();
    this.itemList = null;
  }
  initUpdatePage() {
    this.updateCurrentHighlight('start');
    this.updateListRender();
  }
  onResize() { }
  enablePageButton() {
    this.pageButton.disabled = false;
  }
  disablePageButton() {
    this.pageButton.disabled = true;
  }
  /** @returns {[number, boolean]} */
  getCurrentIndex() {
    const cursor = this.readPage.getRenderCursor();
    const list = this.getListItems();
    if (!list || !list.length) return [null, null];
    let l = 0, r = list.length - 1;
    while (l <= r) {
      const m = Math.floor((l + r) / 2);
      if (list[m] == null) r = m - 1;
      else if (list[m].cursor > cursor) r = m - 1;
      else l = m + 1;
    }
    if (!list[r]) return [null, null];
    return [r, list[r].cursor === cursor];
  }
  /** @param {'start' | 'nearest'} position */
  updateCurrentHighlight(position) {
    const [index, highlight] = this.getCurrentIndex();
    const current = index === -1 ? null : index;
    const selected = this.itemList.listAllSelected(current);
    if (current == null && !selected.length) return;
    if (current != null && selected.length === 1 && selected[0] === current) return;
    this.itemList.clearSelectItem();
    if (current != null) {
      if (highlight) {
        this.itemList.setSelectItem(current, true);
      }
      if (position) {
        this.itemList.scrollIntoView(current, { block: position });
      }
    }
  }
  /** @returns {ListITem[]} */
  getListItems() {
    return [];
  }
  cursorChange(cursor, config) {
    if (!this.itemList) return;
    this.updateCurrentHighlight('nearest');
  }
  emptyListRender(container) { }
  listItemRender(container, item) { }
  onItemClick(item) {
    this.readPage.setCursor(item.cursor, { resetSpeech: true, resetRender: false });
    if (!this.readPage.useSideIndex) {
      this.indexPage.hide();
    }
  }
  pageButtonAction() { }
  listUpdated() {
    requestAnimationFrame(() => {
      this.updateCurrentHighlight('start');
    });
  }
  refreshList() {
    this.itemList.setList([...this.getListItems()]);
    this.listUpdated();
  }
}
