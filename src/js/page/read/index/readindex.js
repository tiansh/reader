/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import config from '../../../data/config.js';
import file from '../../../data/file.js';
import text from '../../../text/text.js';
import ReadPage from '../readpage.js';

export default class ReadIndex {
  /**
   * @param {ReadPage} readPage
   */
  constructor(readPage) {
    this.readPage = readPage;
    if (!this.readPage.index) {
      this.readPage.index = {
        id: this.readPage.articleId,
      };
    }
    this.index = this.readPage.index;
    if (!this.index.content || !Array.isArray(this.index.content.items)) {
      this.index.content = { template: '', items: [] };
    }
    if (!Array.isArray(this.index.bookmarks)) {
      this.index.bookmarks = [];
    }
    this.config = null;
    Promise.all([
      // EXPERT_CONFIG Maximum length of line for table of contents
      config.expert('text.contents_max_length', 'number', 100),
      // EXPERT_CONFIG Maximum size of table of contents
      config.expert('text.contents_size_limit', 'number', 5000),
    ]).then(([maxLength, limit]) => {
      this.config = { maxLength, limit };
    });
    this.content = this.readPage.content;
  }
  writeIndex() {
    file.setIndex(this.index);
  }
  getBookmarkList() {
    return this.index.bookmarks;
  }
  addBookmark(cursor) {
    const bookmarks = this.getBookmarkList();
    const found = bookmarks.find(item => Number(item.cursor) === cursor);
    if (found) return;
    const next = bookmarks.findIndex(item => Number(item.cursor) > cursor);
    const title = this.content.substr(cursor, 200).trim().split('\n')[0].slice(0, 50);
    const bookmark = { cursor, createTime: new Date(), title };
    if (next === -1) bookmarks.push(bookmark);
    else bookmarks.splice(next, 0, bookmark);
    this.writeIndex();
  }
  deleteBookmark(cursor) {
    const index = this.getIndexOfBookmarksByCursor(cursor);
    if (index === -1) return false;
    this.getBookmarkList().splice(index, 1);
    this.writeIndex();
    return true;
  }
  getIndexOfBookmarksByCursor(cursor) {
    const items = this.getBookmarkList();
    const index = items.findIndex(item => item.cursor === cursor);
    return index;
  }
  getContentsList() {
    if (!this.index.content) return null;
    return this.index.content.items;
  }
  getIndexOfContentsByCursor(cursor) {
    const contents = this.getContentsList();
    if (!contents) return null;
    let low = 0, high = contents.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (contents[mid].cursor <= cursor) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return high;
  }
  getContentsByIndex(index) {
    const contents = this.getContentsList();
    if (!contents) return null;
    return contents[index] ?? null;
  }
  getContentsByCursor(cursor) {
    const index = this.getIndexOfContentsByCursor(cursor);
    return this.getContentsByIndex(index);
  }
  getContentsTemplate() {
    return this.index.content.template;
  }
  setContents(template) {
    const content = this.index.content;
    content.template = template;
    if (template && this.config) {
      content.items = text.generateContent(this.content, template, this.config);
      if (content.items) {
        content.items.unshift({ title: this.readPage.meta.title, cursor: 0 });
      } else {
        content.items = [];
      }
    } else {
      content.items = [];
    }
    this.writeIndex();
  }
}
