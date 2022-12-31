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
import i18n from '../../../i18n/i18n.js';
import template from '../../../ui/util/template.js';
import config from '../../../data/config.js';

export default class IndexSearchPage extends IndexSubPage {
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
    return template.iconButton('remove', i18n.getMessage('buttonSearchClear'));
  }
  onFirstActivate() {
    super.onFirstActivate();

    this.searchForm = this.container.querySelector('.search-box form');
    this.searchInput = this.searchForm.querySelector('input');
    this.searchPlaceholder = this.container.querySelector('.search-box-placehodler');

    this.searchInput.placeholder = i18n.getMessage('readSearchPlaceholder');

    this.searchButton = template.iconButton('go', i18n.getMessage('buttonSearchSubmit'));
    this.searchForm.appendChild(this.searchButton);
    this.searchButton.classList.add('submit-button');
    this.searchButton.type = 'submit';

    this.searchForm.addEventListener('submit', event => {
      const text = this.searchInput.value;
      if (text) this.searchText(text);
      else this.clearSearch();
      event.preventDefault();
      this.searchPlaceholder.focus();
    });

    this.disablePageButton();
    this.searchResultList = [];
  }
  onActivate() {
    super.onActivate();
    this.searchInput.value = '';
    this.clearSearch();
  }
  setCurrent() {
    super.setCurrent();
    const cursorOnTab = this.indexPage.tabGroup === document.activeElement;
    const emptySearch = this.itemList.isListEmpty();
    if (emptySearch && !cursorOnTab) {
      const pageReady = () => {
        this.searchInput.focus();
      };
      let timeout = false;
      setTimeout(() => { timeout = true; }, 10e3);
      const waitPageReady = () => {
        const container = this.container;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        if (!rect) return;
        if (!rect.x && !rect.y) pageReady();
        else if (!timeout) requestAnimationFrame(waitPageReady);
      };
      requestAnimationFrame(waitPageReady);
    }
  }
  async searchText(searchTerm) {
    if (searchTerm) {
      this.clearSearch();
      this.emptyListSpan.textContent = i18n.getMessage('readSearchEmpty', searchTerm);
      this.lastSearchText = searchTerm;
      this.lastSearchCursor = 0;
      this.lastSearchLine = 0;
      this.totalSearchHit = 0;
    }

    const currentSearchTerm = this.lastSearchText;
    const [mode, flags] = await Promise.all([
      config.expert('text.search_mode', 'string', 'text'),
      config.expert('text.search_flags', 'string', 'iu'),
    ]);
    let reg = /(?!)/;
    if (mode === 'regex') {
      try {
        reg = new RegExp(currentSearchTerm, flags);
      } catch (e1) { /* ignore */ }
    } else if (mode === 'wildcard') {
      try {
        const escaped = currentSearchTerm.replace(/[-[\]{}()*+?.,\\^$|#]|\s+/g,
          c => /\s+/.test(c) ? '\\s+' : c === '*' ? '.*?' : `\\u${c.charCodeAt().toString(16).padStart(4, 0)}`);
        reg = new RegExp('(' + escaped + ')', flags);
      } catch (e2) { /* ignore */ }
    } else {
      try {
        const escaped = currentSearchTerm.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,
          c => `\\u${c.charCodeAt().toString(16).padStart(4, 0)}`);
        reg = new RegExp('(' + escaped + ')', flags);
      } catch (e3) { /* ignore */ }
    }
    this.lastSearchReg = reg;
    const lines = this.readPage.content.split('\n'), linum = lines.length;

    const searchResult = this.searchResultList;
    const lastSearchResultSize = searchResult.length;
    if (lastSearchResultSize && searchResult[lastSearchResultSize - 1] == null) {
      this.itemList.removeItem(lastSearchResultSize - 1);
      searchResult.pop();
    }
    const searchLimit = 1000;
    let searchHit = 0;
    let cursor = this.lastSearchCursor, i = this.lastSearchLine;
    for (; i < linum; i++) {
      if (searchHit === searchLimit) {
        searchResult.push(null);
        break;
      }
      const line = lines[i];
      if (reg.test(line)) {
        searchResult.push({ cursor, line });
        searchHit++;
      }
      cursor += line.length + 1;
    }
    this.lastSearchLine = i;
    this.lastSearchCursor = cursor;
    this.totalSearchHit += searchHit;
    this.itemList.appendList(searchResult.slice(lastSearchResultSize));
    this.enablePageButton();
    this.listUpdated();
  }
  clearSearch() {
    this.searchResultList = [];
    this.itemList.setList([]);
    this.disablePageButton();
    this.emptyListSpan.textContent = i18n.getMessage('readSearchInitial');
  }
  pageButtonAction() {
    this.clearSearch();
    this.searchInput.value = '';
  }
  emptyListRender(container) {
    const span = container.appendChild(document.createElement('span'));
    span.textContent = i18n.getMessage('readSearchInitial');
    this.emptyListSpan = span;
  }
  listItemRender(container, item) {
    if (item) {
      const reg = this.lastSearchReg;
      const element = container.appendChild(document.createElement('div'));
      element.classList.add('index-search-item');
      element.lang = this.readPage.langTag;
      const line = item.line;
      const matching = line.match(reg) || { index: 0, 0: '' };
      const index = matching.index;
      const size = matching[0].length;
      const left = Math.max(index - 10, 0);
      const right = Math.min(left + 200, line.length);
      const cursor = item.cursor;
      const leftText = line.slice(left, index).trimStart();
      const matchText = line.slice(index, index + size);
      const rightText = line.slice(index + size, right).trimRight();
      element.appendChild(document.createTextNode(leftText));
      element.appendChild(document.createElement('mark')).textContent = matchText;
      element.appendChild(document.createTextNode(rightText));
      element.dataset.cursor = cursor;
    } else {
      const text = container.appendChild(document.createElement('div'));
      text.classList.add('index-search-item', 'index-search-item-more');
      text.textContent = i18n.getMessage('readSearchTooMany', this.totalSearchHit);
    }
  }
  getListItems() {
    return this.searchResultList;
  }
  getCurrentIndex() {
    return super.getCurrentIndex();
  }
  onItemClick(searchResult) {
    if (!searchResult) {
      this.searchText();
    } else {
      super.onItemClick(searchResult);
    }
  }
}

