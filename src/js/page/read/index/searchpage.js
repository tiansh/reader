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
  }
  onActivate() {
    super.onActivate();
    this.searchInput.value = '';
  }
  setCurrent() {
    super.setCurrent();
    const cursorOnTab = this.indexPage.tabGroup === document.activeElement;
    const emptySearch = this.itemList.isListEmpty();
    if (emptySearch && !cursorOnTab) {
      setTimeout(() => { // wait for css transition end
        if (this.isCurrent) this.searchInput.focus();
      }, 210);
    }
  }
  searchText(searchTerm) {
    if (searchTerm) {
      this.clearSearch();
      this.emptyListSpan.textContent = i18n.getMessage('readSearchEmpty', searchTerm);
      this.lastSearchText = searchTerm;
      this.lastSearchCursor = 0;
      this.lastSearchLine = 0;
      this.totalSearchHit = 0;
    }
    const escaped = this.lastSearchText.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,
      c => `\\u${c.charCodeAt().toString(16).padStart(4, 0)}`);
    const reg = new RegExp('(' + escaped + ')', 'i');
    this.lastSearchReg = reg;
    const lines = this.readPage.content.split('\n'), linum = lines.length;

    const searchResult = this.lastSearchResult;
    searchResult.pop();
    const lastSearchResultSize = searchResult.length;
    if (lastSearchResultSize) this.itemList.removeItem(lastSearchResultSize);
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
  }
  clearSearch() {
    this.lastSearchResult = [];
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
      const index = line.match(reg).index;
      const text = line.substr(Math.max(index - 10, 0), 200).trim().slice(0, 50);
      text.split(reg).forEach((part, index) => {
        if (index % 2 === 1) {
          element.appendChild(document.createElement('mark')).textContent = part;
        } else {
          element.appendChild(document.createTextNode(part));
        }
      });
    } else {
      const text = container.appendChild(document.createElement('div'));
      text.classList.add('index-search-item', 'index-search-item-more');
      text.textContent = i18n.getMessage('readSearchTooMany', this.totalSearchHit);
    }
  }
  onItemClick(searchResult) {
    if (!searchResult) {
      this.searchText();
    } else {
      super.onItemClick(searchResult);
    }
  }
}

