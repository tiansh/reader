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
import i18n from '../../../i18n/i18n.js';
import template from '../../../ui/util/template.js';

export default class IndexBookmarkPage extends IndexSubPage {
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
    return template.iconButton('bookmark', i18n.getMessage('buttonBookmarkAdd'));
  }
  onFirstActivate() {
    super.onFirstActivate();
    this.dateFormatter = new Intl.DateTimeFormat(navigator.language, {
      year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric',
    });
    this.dateLang = navigator.language;
  }
  addBookmark() {
    const index = this.readPage.index;
    if (!index.bookmarks) index.bookmarks = [];
    const cursor = this.readPage.meta.cursor;
    const bookmarks = index.bookmarks;
    const found = bookmarks.find(b => Number(b.cursor) === cursor);
    if (found) return;
    const next = bookmarks.findIndex(b => Number(b.cursor) > cursor);
    const title = this.readPage.content.substr(cursor, 200).trim().split('\n')[0].slice(0, 50);
    const bookmark = { cursor, createTime: new Date(), title };
    if (next === -1) bookmarks.push(bookmark);
    else bookmarks.splice(next, 0, bookmark);
    file.setIndex(this.readPage.index);
    this.setList(bookmarks.slice(0));
    this.updateCurrentHighlight();
  }
  pageButtonAction() {
    this.addBookmark();
  }
  emptyListRender(container) {
    const span = container.appendChild(document.createElement('span'));
    span.textContent = i18n.getMessage('readBookmarkEmpty');
  }
  listItemRender(container, item) {
    if (!container.firstChild) {
      const ref = template.create('bookmarkItem');
      container.appendChild(ref.get('root'));
      const text = ref.get('text');
      text.textContent = item.title;
      text.lang = this.readPage.langTag;
      const time = ref.get('time');
      time.textContent = this.dateFormatter.format(item.createTime);
      time.lang = this.dateLang;
      const contents = this.indexPage.contentsPage.getContentsByCursor(item.cursor);
      if (contents) {
        const contents = ref.get('contents');
        contents.textContent = contents.title;
        contents.lang = this.readPage.langTag;
      }
    }
  }
  getListItems() {
    const index = this.readPage.index;
    return index.bookmarks || [];
  }
  getCurrentHighlightIndex() {
    const cursor = this.readPage.meta.cursor;
    const items = this.readPage.index.bookmarks || [];
    const index = items.findIndex(item => item.cursor === cursor);
    if (index === -1) return null;
    return index;
  }
  updateBookmarkList() {
    this.setList(this.getListItems());
  }
  onRemoveItem(bookmark) {
    const bookmarks = this.readPage.index.bookmarks || [];
    const index = bookmarks.findIndex(i => i.cursor === bookmark.cursor);
    if (index === -1) return;
    bookmarks.splice(index, 1);
    file.setIndex(this.readPage.index);
    if (this.itemList) {
      this.itemList.removeItem(index);
      this.updateCurrentHighlight();
    }
  }
}
