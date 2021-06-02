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
    this.isShow = false;
    this.tabItem = tabItem;
    this.pageIndex = index;
    this.indexPage = indexPage;
    this.tabGroup = this.tabItem.closest('.tab-group');
    this.pageButtonAction = this.pageButtonAction.bind(this);
  }
  show() {
    this.isShow = true;
    this.indexPage.container.style.setProperty('--tab-index-current', this.pageIndex);
    this.tabGroup.style.setProperty('--active-index', this.pageIndex);
    this.indexPage.currentActiveIndex = this.pageIndex;
    this.focusCurrentItem();
    this.container.removeAttribute('aria-hidden');
    dom.enableKeyboardFocus(this.container);
  }
  hide() {
    this.isShow = false;
    this.container.setAttribute('aria-hidden', 'true');
    dom.disableKeyboardFocus(this.container);
  }
  createPageButton() { }
  onFirstActivate() {
    super.onFirstActivate();

    const headerRef = template.create('header');
    this.container.insertBefore(headerRef.get('root'), this.container.firstChild);
    const backButton = template.iconButton('back', i18n.getMessage('buttonBack'));
    this.backButton = headerRef.get('left').appendChild(backButton);
    this.pageButton = this.createPageButton();
    headerRef.get('right').appendChild(this.pageButton);

    this.tabItem.addEventListener('click', event => {
      this.indexPage.showPage(this);
    });
    this.backButton.addEventListener('click', event => {
      this.indexPage.hide();
    });

    this.listElement = this.container.querySelector('.index-list');
  }
  onActivate() {
    const items = this.getListItems();
    const onItemClick = this.onItemClick.bind(this);
    const render = this.listItemRender.bind(this);
    const emptyListRender = this.emptyListRender.bind(this);
    const onRemove = this.onRemoveItem && this.onRemoveItem.bind(this);
    this.itemList = new ItemList(this.listElement, {
      list: items.slice(0),
      onItemClick,
      render,
      selectable: true,
      emptyListRender,
      onRemove,
    });
    this.currentContentsIndex = null;

    this.pageButton.addEventListener('click', this.pageButtonAction);

    this.updateCurrentHighlight();
  }
  onInactivate() {
    this.itemList.dispatch();
    this.itemList = null;
  }
  focusCurrentItem() {
    if (this.itemList && this.currentContentsIndex != null) {
      const element = this.itemList.getItemElement(this.currentContentsIndex).closest('.list-item');
      const list = element.closest('.index-list');
      list.scrollTop = element.offsetTop;
    }
  }
  getCurrentHighlightIndex() {
    return null;
  }
  updateCurrentHighlight() {
    const current = this.getCurrentHighlightIndex();
    if (this.currentContentsIndex === current) return;
    this.itemList.clearSelectItem();
    if (current != null) {
      this.itemList.setSelectItem(current, true);
      this.itemList.scrollIntoView(current);
    }
    this.currentContentsIndex = current;
  }
  getListItems() {
    return [];
  }
  cursorChange() {
    if (!this.itemList) return;
    this.updateCurrentHighlight();
  }
  emptyListRender() { }
  listItemRender() { }
  onItemClick(item) {
    this.readPage.setCursor(item.cursor);
    if (!this.readPage.useSideIndex) {
      this.indexPage.hide();
    }
  }
  pageButtonAction() { }
  setList(newList) {
    this.itemList.setList(newList);
    this.updateCurrentHighlight();
  }
}
