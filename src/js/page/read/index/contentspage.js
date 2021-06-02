/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import IndexSubPage from './indexsubpage.js';
import IndexPage from './indexpage.js';
import ReadPage from '../readpage.js';
import file from '../../../data/file.js';
import text from '../../../text/text.js';
import i18n from '../../../i18n/i18n.js';
import template from '../../../ui/util/template.js';

export default class IndexContentsPage extends IndexSubPage {
  /**
   * @param {HTMLElement} container
   * @param {HTMLElement} tabItem
   * @param {number} index
   * @param {IndexPage} indexPage
   * @param {ReadPage} readPage
   */
  constructor(container, tabItem, index, indexPage, readPage) {
    super(container, tabItem, index, indexPage, readPage);
  }
  createPageButton() {
    return template.iconButton('refresh', i18n.getMessage('buttonContentsRefresh'));
  }
  refreshContents() {
    if (!this.readPage.index.content) {
      this.readPage.index.content = { template: '', items: [] };
    }
    const content = this.readPage.index.content;
    const input = prompt(i18n.getMessage('readContentsTemplate'), content.template);
    content.template = (input == null ? content.template : input) || '';
    if (content.template) {
      content.items = text.generateContent(this.readPage.content, content.template);
      content.items.unshift({ title: this.readPage.meta.title, cursor: 0 });
    } else {
      content.items = [];
    }
    file.setIndex(this.readPage.index);
    this.setList(content.items.slice(0));
    this.indexPage.bookmarkPage.updateBookmarkList();
    this.updateCurrentHighlight();
    this.readPage.textPage.forceUpdate();
  }
  pageButtonAction() {
    this.refreshContents();
  }
  getContentsByCursor(cursor) {
    const index = this.readPage.index;
    const items = index.content && index.content.items || [];
    let last = items[0];
    items.every(item => {
      if (item.cursor > cursor) return false;
      last = item;
      return true;
    });
    return last || null;
  }
  emptyListRender(container) {
    const span = container.appendChild(document.createElement('span'));
    span.textContent = i18n.getMessage('readContentsEmpty');
  }
  listItemRender(container, item) {
    if (!container.firstChild) {
      const element = container.appendChild(document.createElement('div'));
      element.classList.add('index-contents-item');
    }
    const title = container.firstChild;
    title.textContent = item.title;
    title.lang = this.readPage.langTag;
  }
  getListItems() {
    const index = this.readPage.index;
    return index.content && index.content.items || [];
  }
  getCurrentHighlightIndex() {
    const cursor = this.readPage.meta.cursor;
    const items = this.readPage.index.content && this.readPage.index.content.items || [];
    const item = this.getContentsByCursor(cursor);
    const index = items.indexOf(item);
    if (index === -1) return null;
    return index;
  }
}
