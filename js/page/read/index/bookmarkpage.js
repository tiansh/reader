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
    this.readPage.readIndex.addBookmark(this.readPage.getRenderCursor());
    this.refreshList();
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
      const contents = this.readPage.readIndex.getContentsByCursor(item.cursor);
      if (contents) {
        const contentsElement = ref.get('contents');
        contentsElement.textContent = contents.title;
        contentsElement.lang = this.readPage.getLang();
      }
    }
  }
  getListItems() {
    return Array.from(this.readPage.readIndex.getBookmarkList());
  }
  getCurrentIndex() {
    return super.getCurrentIndex();
  }
  onRemoveItem(bookmark) {
    const readIndex = this.readPage.readIndex;
    const index = readIndex.getIndexOfBookmarksByCursor(bookmark.cursor);
    if (index === -1) return;
    readIndex.deleteBookmark(bookmark.cursor);
    if (this.itemList) {
      this.itemList.removeItem(index);
    }
  }
}
