/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
*/

import Page from './page.js';
import text from './text.js';
import file from './file.js';
import onResize from './onresize.js';
import { TouchGestureListener } from './touch.js';
import speech from './speech.js';
import config from './config.js';
import i18n from './i18n.js';
import RangeInput from './range.js';
import template from './template.js';
import ItemList from './itemlist.js';
import dom from './dom.js';

class ReadSubPage {
  /**
   * @param {HTMLElement} container
   * @param {ReadPage} readPage
   */
  constructor(container, readPage) {
    this.container = container;
    this.readPage = readPage;

    this.isCurrent = false;
    this.hide();
  }
  show() {
    this.isCurrent = true;
    this.container.classList.add('read-sub-page-current');
    this.container.removeAttribute('aria-hidden');
    dom.enableKeyboardFocus(this.container);
    dom.disableKeyboardFocus(this.readPage.controlPage.container);
  }
  hide() {
    this.isCurrent = false;
    this.container.classList.remove('read-sub-page-current');
    this.container.setAttribute('aria-hidden', 'true');
    dom.disableKeyboardFocus(this.container);
    dom.enableKeyboardFocus(this.readPage.controlPage.container);
  }
  currentActive() {
    return this.isCurrent;
  }
  onFirstActivate() { }
  onActivate() {
    this.hide();
  }
  onInactivate() { }
}

class IndexSubPage extends ReadSubPage {
  /**
   * @param {HTMLElement} container
   * @param {HTMLElement} tabItem
   * @param {number} index
   * @param {IndexPage} indexPage
   * @param {ReadPage} readPage
   */
  constructor(container, tabItem, index, indexPage, readPage) {
    super(container, readPage);
    this.tabItem = tabItem;
    this.pageIndex = index;
    this.indexPage = indexPage;
    this.tabGroup = this.tabItem.closest('.tab-group');
    this.onCursorChange = this.onCursorChange.bind(this);
    this.pageButtonAction = this.pageButtonAction.bind(this);
  }
  show() {
    this.indexPage.container.style.setProperty('--tab-index-current', this.pageIndex);
    this.tabGroup.style.setProperty('--active-index', this.pageIndex);
    this.indexPage.currentActiveIndex = this.pageIndex;
    this.focusCurrentItem();
    this.container.removeAttribute('aria-hidden');
    dom.enableKeyboardFocus(this.container);
  }
  hide() {
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

    this.readPage.onCursorChange(this.onCursorChange);

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
    }
    this.currentContentsIndex = current;
  }
  getListItems() {
    return [];
  }
  onCursorChange() {
    if (!this.itemList) return;
    this.updateCurrentHighlight();
  }
  emptyListRender() { }
  listItemRender() { }
  onItemClick(item) {
    this.readPage.setCursor(item.cursor);
    this.indexPage.hide();
  }
  pageButtonAction() { }
  setList(newList) {
    this.itemList.setList(newList);
    this.updateCurrentHighlight();
  }
}

class IndexContentsPage extends IndexSubPage {
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
    content.template = prompt(i18n.getMessage('readContentsTemplate'), content.template) || '';
    if (content.template) {
      content.items = text.generateContent(this.readPage.content, content.template);
      content.items.unshift({ title: this.readPage.meta.title, cursor: 0 });
    } else {
      content.items = [];
    }
    file.setIndex(this.readPage.index);
    this.setList(content.items.slice(0));
    this.indexPage.bookmarkPage.updateBookmarkList();
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

class IndexBookmarkPage extends IndexSubPage {
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
    bookmarks.splice(index);
    file.setIndex(this.readPage.index);
    if (this.itemList) {
      this.itemList.removeItem(index);
      this.updateCurrentHighlight();
    }
  }
}

class IndexSearchPage extends IndexSubPage {
  constructor(container, tabItem, index, indexPage, readPage) {
    super(container, tabItem, index, indexPage, readPage);
  }
  createPageButton() {
    return template.iconButton('remove', i18n.getMessage('buttonSearchClear'));
  }
  onFirstActivate() {
    super.onFirstActivate();

    this.searchForm = this.container.querySelector('.search-box form');
    this.searchInput = this.container.querySelector('.search-input');
    this.searchForm.addEventListener('submit', event => {
      const text = this.searchInput.value;
      if (text) this.searchText(text);
      else this.clearSearch();
      event.preventDefault();
    });
  }
  searchText(searchTerm) {
    if (searchTerm) {
      this.clearSearch();
      this.emptyListSpan.textContent = i18n.getMessage('readSearchEmpty');
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
  }
  clearSearch() {
    this.lastSearchResult = [];
    this.itemList.setList([]);
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

class IndexPage extends ReadSubPage {
  constructor(container, readPage) {
    super(container, readPage);
  }
  onFirstActivate() {
    this.contentsPageElement = this.container.querySelector('#read_index_contents');
    this.contentsPageTabElement = this.container.querySelector('#read_index_contents_tab');
    this.contentsPage = new IndexContentsPage(this.contentsPageElement, this.contentsPageTabElement, 0, this, this.readPage);
    this.contentsPageTabElement.appendChild(template.icon('contents', i18n.getMessage('buttonContents')));

    this.bookmarkPageElement = this.container.querySelector('#read_index_bookmark');
    this.bookmarkPageTabElement = this.container.querySelector('#read_index_bookmark_tab');
    this.bookmarkPage = new IndexBookmarkPage(this.bookmarkPageElement, this.bookmarkPageTabElement, 1, this, this.readPage);
    this.bookmarkPageTabElement.appendChild(template.icon('bookmark', i18n.getMessage('buttonBookmark')));

    this.searchPageElement = this.container.querySelector('#read_index_search');
    this.searchPageTabElement = this.container.querySelector('#read_index_search_tab');
    this.searchPage = new IndexSearchPage(this.searchPageElement, this.searchPageTabElement, 2, this, this.readPage);
    this.searchPageTabElement.appendChild(template.icon('search', i18n.getMessage('buttonSearch')));

    this.subPages = [this.contentsPage, this.bookmarkPage, this.searchPage];
    this.subPageMap = { contents: this.contentsPage, bookmark: this.bookmarkPage, search: this.searchPage };

    this.currentActiveIndex = 0;

    this.subPages.forEach(page => page.onFirstActivate());

    this.tabGroupContainer = this.container.querySelector('.index-tab-group');

    this.tabGroup = this.container.querySelector('.tab-group');
    this.tabGroup.addEventListener('keydown', event => {
      let targetPage = null;
      if (event.code === 'ArrowRight') {
        targetPage = this.subPages[this.currentActiveIndex + 1];
      } else if (event.code === 'ArrowLeft') {
        targetPage = this.subPages[this.currentActiveIndex - 1];
      }
      if (targetPage) this.showPage(targetPage);
    });

  }
  onActivate() {
    super.onActivate();
    this.subPages.forEach(page => page.onActivate());
  }
  onInactivate() {
    super.onInactivate();
    this.subPages.forEach(page => page.onInactivate());
  }
  slideShow(action, offset) {
    if (action === 'move') {
      this.container.style.bottom = `calc(100vh - ${offset}px)`;
      this.container.classList.add('read-index-slide');
    } else {
      this.container.classList.remove('read-index-slide');
      if (action === 'down') {
        window.requestAnimationFrame(() => {
          this.show();
        });
      } else {
        this.container.style.bottom = `100vh`;
      }
    }
  }
  showPage(targetPage) {
    this.subPages.forEach(page => {
      if (page !== targetPage) page.hide();
    });
    targetPage.show();
  }
  show(/** @type {'contents'|'bookmark'|'search'|null} */page = null) {
    super.show();
    this.container.style.bottom = '0';
    if (page) this.showPage(this.subPageMap[page]);
    else this.showPage(this.subPages[this.currentActiveIndex]);
  }
  hide() {
    super.hide();
    this.container.style.bottom = '100vh';
  }
}

class JumpPage extends ReadSubPage {
  constructor(container, readPage) {
    super(container, readPage);
    this.onCursorChange = this.onCursorChange.bind(this);
  }
  onFirstActivate() {
    this.rangeBar = this.container.querySelector('#jump_range');
    this.rangeInput = new RangeInput(this.rangeBar, { min: 0, max: 1, step: 1 });
    this.readPage.onCursorChange(this.onCursorChange);
    this.rangeInput.onChange(cursor => {
      this.readPage.setCursor(cursor);
    });
    this.coverElement = this.container.querySelector('.read-jump-cover');
    this.coverElement.addEventListener('touchstart', event => {
      this.hide();
    });
    this.coverElement.addEventListener('mousedown', event => {
      if (event.button === 0) this.hide();
    });
  }
  onActivate() {
    super.onActivate();
    this.rangeInput.setConfig({
      min: 0,
      max: this.readPage.content.length,
      step: 1,
    });
    this.updateInputValue();
  }
  show() {
    super.show();
    this.updateInputValue();
  }
  onCursorChange() {
    this.updateInputValue();
  }
  updateInputValue() {
    const cursor = this.readPage.meta.cursor;
    this.rangeInput.setValue(cursor);
  }
}

class ReadSpeech {
  /**
   * @param {ReadPage} page
   */
  constructor(page) {
    this.readBuffer = 500;
    this.maxPendingSsuSize = 10;

    this.page = page;

    this.speaking = false;
    this.spoken = null;

    this.listenEvents();

    this.onBoundary = this.onBoundary.bind(this);
    this.onEnd = this.onEnd.bind(this);
  }
  listenEvents() {
    this.listenMediaDeviceChange();
    window.addEventListener('beforeunload', event => {
      this.stop();
    });
    this.page.onCursorChange(cursor => {
      this.updateCursor(cursor);
    });
  }
  async listenMediaDeviceChange() {
    if (!navigator.mediaDevices) return false;
    if (!navigator.mediaDevices.enumerateDevices) return false;
    let audioOutputCount = null;
    return new Promise(resolve => {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        audioOutputCount = devices.filter(x => x.kind === 'audiooutput').length;
        navigator.mediaDevices.addEventListener('devicechange', () => {
          navigator.mediaDevices.enumerateDevices().then(devices => {
            const count = devices.filter(x => x.kind === 'audiooutput').length;
            if (count < audioOutputCount) this.stop();
            audioOutputCount = count;
          });
        });
        resolve(true);
      });
    });
  }
  onBoundary(event) {
    if (!this.speaking) return;
    const ssu = event.target;
    this.pendingSsu.delete(ssu);
    const nextPage = this.page.pages.current.nextCursor;
    const start = ssu.data.start + event.charIndex;
    const len = Math.max(0, Math.min(event.charLength || ssu.data.end - start, nextPage - start));
    if (nextPage && start > nextPage) {
      this.lastPageCursor = nextPage;
      this.page.nextPage();
    }
    this.spoken = start;
    this.highlightChars(start, len);
    this.readMore();
  }
  onEnd(event) {
    if (!this.speaking) return;
    const ssu = event.target;
    if (ssu.data.end === this.page.content.length) {
      this.stop();
    } else {
      this.clearHighlight();
      if (this.pendingSsu && this.pendingSsu.has(ssu)) {
        this.pendingSsu.delete(ssu);
        this.spoken = ssu.data.end;
        this.readMore();
      }
    }
    ssu.removeEventListener('boundary', this.onBoundary);
    ssu.removeEventListener('end', this.onEnd);
  }
  readNext() {
    const current = this.next;
    const line = this.page.content.indexOf('\n', current) + 1;
    const end = Math.min(line || this.page.content.length, current + this.readBuffer);
    this.next = end;
    const text = this.page.content.slice(current, end).trimRight();
    if (!text) return;
    const ssu = speech.prepare(text);
    ssu.data = { start: current, end };
    ssu.addEventListener('boundary', this.onBoundary);
    ssu.addEventListener('end', this.onEnd);
    this.pendingSsu.add(ssu);
    speechSynthesis.speak(ssu);
  }
  async readMore() {
    if (this.lastReset) return;
    if (!this.speaking) return;
    if (this.readMoreBusy) return;
    this.readMoreBusy = true;
    const length = this.page.content.length;
    const size = this.readBuffer;
    while (
      this.speaking &&
      this.next < Math.min(length, this.spoken + size) &&
      this.pendingSsu.size <= this.maxPendingSsuSize
    ) {
      this.readNext();
      await new Promise(resolve => { setTimeout(resolve, 0); });
    }
    this.readMoreBusy = false;
  }
  async start() {
    if (this.lastReset) return;
    if (this.speaking) return;
    if (speechSynthesis.speaking || speechSynthesis.pending) return;
    this.readMoreBusy = false;
    const page = this.page;
    page.element.classList.add('read-speech');
    this.next = page.pages.current.cursor;
    do {
      if (!this.spoken) break;
      if (this.spoken < this.next) break;
      if (!page.pages.next) break;
      if (this.spoken >= page.pages.next.cursor) break;
      this.next = this.spoken;
    } while (false);
    this.lastPageCursor = this.next;
    this.spoken = this.next;
    this.pendingSsu = new Set();
    this.speaking = true;
    this.readMore();
  }
  async stop() {
    if (!this.speaking) return;
    this.page.element.classList.remove('read-speech');
    this.clearHighlight();
    this.speaking = false;
    this.pendingSsu = null;
    while (speechSynthesis.speaking || speechSynthesis.pending) {
      speechSynthesis.cancel();
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  async reset() {
    const token = this.lastReset = {};
    await this.stop();
    /*
     * FIXME
     * I don't know why!
     * But safari doesn't work if we don't give a pause.
     * I'm not sure how long would be suitable.
     * I just make it work on my iPhone with 1s delay.
     * This should be changed to something more meaningful.
     */
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (token !== this.lastReset) return;
    this.lastReset = null;
    await this.start();
  }
  async toggle() {
    if (this.lastReset) return;
    if (this.speaking) await this.stop();
    else await this.start();
  }
  clearHighlight() {
    Array.from(document.querySelectorAll('.read-highlight')).forEach(container => {
      container.innerHTML = '';
    });
  }
  highlightChars(start, length) {
    if (this.lastHighlightStart === start && this.lastHighlightLength === length) return;
    this.clearHighlight();
    this.lastHighlightStart = start;
    this.lastHighlightLength = length;
    /** @type {HTMLElement} */
    const container = this.page.pages.current.container;
    const paragraphs = Array.from(container.querySelectorAll('p[data-start]'));
    const paragraph = paragraphs.reverse().find(p => p.dataset.start <= start);
    if (!paragraph) return;
    const range = document.createRange();
    const paragraphStart = Number(paragraph.dataset.start);
    const node = paragraph.firstChild;
    if (!node) return;
    const contentLength = node.textContent.length;
    const startPos = start - paragraphStart;
    if (startPos >= contentLength) {
      return;
    }
    const endPos = Math.min(startPos + length, contentLength);
    range.setStart(node, startPos);
    range.setEnd(node, endPos);
    const rects = Array.from(range.getClientRects());
    const highlight = container.querySelector('.read-highlight');
    const containerRect = container.getBoundingClientRect();
    rects.forEach(rect => {
      const span = document.createElement('span');
      span.style.top = (rect.top - containerRect.top) + 'px';
      span.style.left = (rect.left - containerRect.left) + 'px';
      span.style.width = rect.width + 'px';
      span.style.height = rect.height + 'px';
      highlight.appendChild(span);
      return span;
    });
  }
  updateCursor(cursor) {
    if (this.speaking || this.lastReset) {
      if (this.lastPageCursor === cursor) return;
      this.reset();
    } else {
      this.spoken = null;
    }
  }
}

class ControlPage extends ReadSubPage {
  /**
   * @param {HTMLElement} container
   * @param {ReadPage} readPage
   */
  constructor(container, readPage) {
    super(container, readPage);
  }
  onFirstActivate() {
    super.onFirstActivate();

    const headerRef = template.create('header');
    this.container.insertBefore(headerRef.get('root'), this.container.firstChild);
    const backButton = template.iconButton('back', i18n.getMessage('buttonBack'));
    headerRef.get('left').appendChild(backButton);
    this.bookTitleElement = headerRef.get('mid');
    this.backButton = backButton;
    this.hide();

    this.coverElement = this.container.querySelector('.read-control-cover');

    const iconLine = this.container.querySelector('.icon-line');
    const genButton = (type, title) => {
      const item = iconLine.appendChild(document.createElement('div'));
      item.classList.add('icon-line-item');
      const button = item.appendChild(template.iconButton(type, title));
      return button;
    };
    this.contentsButton = genButton('contents', i18n.getMessage('buttonContents'));
    this.bookmarkButton = genButton('bookmark', i18n.getMessage('buttonBookmark'));
    this.searchButton = genButton('search', i18n.getMessage('buttonSearch'));
    this.jumpButton = genButton('jump', i18n.getMessage('buttonJump'));
    this.speechButton = genButton('speech', i18n.getMessage('buttonSpeech'));
    const stopIcon = template.icon('speech-stop', i18n.getMessage('buttonSpeechStop'));
    this.speechButton.querySelector('.icon').after(stopIcon);

    [
      { name: 'contents', button: this.contentsButton },
      { name: 'bookmark', button: this.bookmarkButton },
      { name: 'search', button: this.searchButton },
    ].forEach(({ name, button }) => {
      button.addEventListener('click', event => {
        this.hide();
        this.readPage.indexPage.show(name);
      });
    });
    this.jumpButton.addEventListener('click', event => {
      this.hide();
      this.readPage.jumpPage.show();
    });
    this.speechButton.addEventListener('click', event => {
      this.hide();
      this.readPage.speech.toggle();
    });
    this.backButton.addEventListener('click', event => {
      this.readPage.gotoList();
    });
    this.coverElement.addEventListener('touchstart', event => {
      this.hide();
    });
    this.coverElement.addEventListener('mousedown', event => {
      if (event.button === 0) this.hide();
    });

    const speechContainer = this.speechButton.closest('.icon-line-item');
    speechContainer.hidden = speech.getPreferVoice() == null;
    speech.onPreferVoiceChange(voice => {
      if (!voice) speechContainer.hidden = true;
      else speechContainer.hidden = false;
    });

    this.container.addEventListener('focusin', event => {
      this.hasFocus = true;
      this.container.classList.add('read-control-active');
    });
    this.container.addEventListener('focusout', event => {
      this.hasFocus = false;
      if (!this.isShow) this.container.classList.remove('read-control-active');
    });
  }
  onActivate() {
    super.onActivate();

    this.bookTitleElement.textContent = this.readPage.meta.title;
    this.bookTitleElement.lang = this.readPage.langTag;
    this.hide();
  }
  onInactivate() {
    super.onInactivate();

    this.hide();
  }
  hide() {
    this.isShow = false;
    this.container.classList.remove('read-control-active');
    if (this.hasFocus) {
      this.hasFocus = false;
      document.documentElement.focus();
    }
  }
  show() {
    this.isShow = true;
    this.container.classList.add('read-control-active');
  }
  focus() {
    this.backButton.focus();
  }
}

/**
 * @typedef {Object} PageRender
 * @property {HTMLElement} container
 * @property {number} cursor
 * @property {number} nextCursor
 */

export default class ReadPage extends Page {
  constructor() {
    super(document.querySelector('#read_page'));
    this.onResize = this.onResize.bind(this);
    this.keyboardEvents = this.keyboardEvents.bind(this);
    this.wheelEvents = this.wheelEvents.bind(this);
    this.onCursorChangeCallbackList = [];
  }
  matchUrl(url) {
    if (!/\/read\/\d+/.test(url)) return null;
    const id = +url.split('/').pop();
    if (!id) return null;
    return { id };
  }
  getUrl({ id }) { return '/read/' + id; }
  async onFirstActivate() {
    this.container = document.querySelector('#read_page');

    this.customFont = document.querySelector('#custom_font');
    this.customStyle = document.querySelector('#custom_style');

    this.controlPageElement = this.container.querySelector('.read-control');
    this.controlPage = new ControlPage(this.controlPageElement, this);

    this.indexPageElement = this.container.querySelector('.read-index');
    this.indexPage = new IndexPage(this.indexPageElement, this);

    this.jumpPageElement = this.container.querySelector('.read-jump');
    this.jumpPage = new JumpPage(this.jumpPageElement, this);

    this.speech = new ReadSpeech(this);

    this.subPages = [this.controlPage, this.indexPage, this.jumpPage];
    this.subPages.forEach(page => { page.onFirstActivate(); });

    this.container.addEventListener('scroll', event => {
      this.container.scrollTop = 0;
      this.container.scrollLeft = 0;
      event.preventDefault();
    });
  }
  async onActivate({ id }) {
    this.langTag = await config.get('cjk_lang_tag');

    this.meta = await file.getMeta(id);
    this.index = await file.getIndex(id);
    this.content = await file.content(id);

    if (!this.meta || !this.content) {
      this.gotoList();
      return;
    }

    await file.setMeta(this.meta);

    this.pagesContainer = document.createElement('div');
    this.pagesContainer.classList.add('read-content-pages', 'read-layer');
    this.listenPagesContainer();
    this.container.insertBefore(this.pagesContainer, this.container.firstChild);

    this.pageInfo = onResize.currentSize();

    await this.updateStyleConfig();

    /** @type {{ prev: PageRender, current: PageRender, next: PageRender, isLast: boolean, isFirst: boolean }} */
    this.pages = {};
    window.requestAnimationFrame(() => {
      this.updatePages();
    });

    onResize.addListener(this.onResize);

    document.addEventListener('keydown', this.keyboardEvents);
    document.addEventListener('wheel', this.wheelEvents);

    this.subPages.forEach(page => { page.onActivate(); });
  }
  async onUpdate({ id }) {
    this.onInactivate();
    this.onActivate({ id });
  }
  async onInactivate() {
    this.meta = null;
    this.index = null;
    this.content = null;
    this.pagesContainer.remove();
    this.pagesContainer = null;
    this.pageInfo = null;
    this.pages = null;
    onResize.removeListener(this.onResize);
    document.removeEventListener('keydown', this.keyboardEvents);
    document.removeEventListener('wheel', this.wheelEvents);
    this.subPages.forEach(page => { page.onInactivate(); });
    this.speech.stop();
  }
  gotoList() {
    this.router.go('list');
  }
  onResize() {
    this.stepCache = null;
    this.disposePage(this.pages.prev);
    this.disposePage(this.pages.current);
    this.disposePage(this.pages.next);
    this.pages = {};
    this.updatePages();
  }
  isAnythingSelected() {
    const selection = document.getSelection();
    const container = this.pages.current.container;
    for (let i = 0; i < selection.rangeCount; i++) {
      const range = selection.getRangeAt(i);
      if (range.startContainer === range.endContainer && range.startOffset === range.endOffset) continue;
      if (!container.contains(range.startContainer)) continue;
      return true;
    }
    return false;
  }
  listenPagesContainer() {
    const listener = new TouchGestureListener(this.pagesContainer, {
      yRadian: Math.PI / 5,
      minDistanceY: 60,
    });
    const wos = (f, g) => (...p) => {
      if (this.isAnythingSelected()) {
        if (g) g(...p);
      } else {
        f(...p);
      }
    };
    const cancelX = () => { this.slidePage('cancel'); };
    listener.onMoveX(wos(distance => { this.slidePage('move', distance); }, cancelX));
    listener.onSlideLeft(wos(() => { this.slidePage('left'); }, cancelX));
    listener.onSlideRight(wos(() => { this.slidePage('right'); }, cancelX));
    listener.onCancelX(cancelX);
    const cancelY = () => { this.indexPage.slideShow('cancel'); };
    listener.onMoveY(wos(distance => { this.indexPage.slideShow('move', distance); }, cancelY));
    listener.onSlideUp(wos(() => {
      this.indexPage.slideShow('up');
      this.controlPage.show();
    }, cancelY));
    listener.onSlideDown(wos(() => { this.indexPage.slideShow('down'); }, cancelY));
    listener.onCancelY(cancelY);

    listener.onTouchLeft(wos(() => { this.prevPage(); }));
    listener.onTouchRight(wos(() => { this.nextPage(); }));
    listener.onTouchMiddle(wos(() => { this.controlPage.show(); }));
    this.pagesContainer.addEventListener('contextmenu', event => {
      if (this.isAnythingSelected()) return;
      event.preventDefault();
      if (this.controlPage.isCurrent) this.controlPage.hide();
      else this.controlPage.show();
    }, false);
  }
  keyboardEvents(event) {
    const current = this.subPages.find(page => page.isCurrent);
    if (event.code === 'Escape') {
      if (current) current.hide();
      else if (this.controlPage.hasFocus) this.controlPage.hide();
      else this.controlPage.focus();
    } else if (!current) {
      if (['PageUp', 'ArrowLeft'].includes(event.code)) {
        this.prevPage();
      } else if (['PageDown', 'ArrowRight'].includes(event.code)) {
        this.nextPage();
      } else if (['ArrowUp'].includes(event.code)) {
        this.controlPage.focus();
      } else if (['ArrowDown'].includes(event.code)) {
        this.indexPage.show();
      }
    }
  }
  /**
   * @param {WheelEvent} event
   */
  wheelEvents(event) {
    if (this.wheelBusy) return;
    const deltaY = event.deltaY;
    if (!deltaY) return;
    if (deltaY > 0) this.nextPage();
    else if (deltaY < 0) this.prevPage();
    this.wheelBusy = true;
    setTimeout(() => { this.wheelBusy = false; }, 250);
  }
  /**
   * @param {'move'|'left'|'right'|'cancel'} action
   * @param {number} offset
   */
  slidePage(action, offset) {
    if (action === 'move') {
      let move = offset;
      if (offset < 0 && this.pages.isLast) {
        move = Math.max(-100, offset / 2);
      } else if (offset > 0 && this.pages.isFirst) {
        move = Math.min(100, offset / 2);
      }
      const width = window.innerWidth;
      move = Math.max(-width, Math.min(width, move));
      this.pagesContainer.style.setProperty('--slide-x', move + 'px');
      this.pagesContainer.classList.add('read-content-pages-slide');
    } else {
      this.pagesContainer.style.setProperty('--slide-x', '0px');
      this.pagesContainer.classList.remove('read-content-pages-slide');
    }
    window.requestAnimationFrame(() => {
      if (action === 'left') this.nextPage();
      if (action === 'right') this.prevPage();
    });
  }
  nextPage() {
    if (this.pages.isLast) return;
    this.disposePage(this.pages.prev);
    this.pages.prev = this.pages.current;
    this.pages.current = this.pages.next;
    this.pages.next = null;
    this.updatePages();
    this.updateCursor(this.pages.current.cursor);
  }
  prevPage() {
    if (this.pages.isFirst) return;
    this.disposePage(this.pages.next);
    this.pages.next = this.pages.current;
    this.pages.current = this.pages.prev;
    this.pages.prev = null;
    this.updatePages();
    this.updateCursor(this.pages.current.cursor);
  }
  updateCursor(cursor) {
    this.writeCursor(cursor);
    this.onCursorChangeCallbackList.forEach(callback => { callback(cursor); });
  }
  writeCursor(cursor) {
    this.meta.cursor = cursor;
    file.setMeta(this.meta);
  }
  async updateStyleConfig() {
    const keys = [
      'light_text', 'light_background', 'dark_text', 'dark_background',
      'font_size', 'font_family', 'font_list',
      'line_height', 'paragraph_spacing',
    ];
    const configs = Object.fromEntries(await Promise.all(keys.map(async key => [key, await config.get(key)])));
    const font = configs.font_family && Array.isArray(configs.font_list) &&
      configs.font_list.find(font => font.id === configs.font_family).content || null;
    this.customFont.textContent = [
      font ? `@font-face { font-family: "CustomFont"; src: url("${font}"); }` : '',
    ].join('\n');
    this.customStyle.textContent = [
      `.dark-theme .read-content-page { color: ${configs.dark_text}; background: ${configs.dark_background}; }`,
      `.light-theme .read-content-page { color: ${configs.light_text}; background: ${configs.light_background}; }`,
      `.read-content-page { font-size: ${configs.font_size}px; line-height: ${configs.line_height}; }`,
      `.read-content-page p:not(:first-child) { margin-top: ${configs.paragraph_spacing * configs.line_height * configs.font_size}px; }`,
      font ? `.read-content-page { font-family: CustomFont; }` : '',
    ].join('\n');
    this.configs = configs;
  }
  setCursor(cursor) {
    this.disposePage(this.pages.prev);
    this.disposePage(this.pages.current);
    this.disposePage(this.pages.next);
    this.pages.prev = null;
    this.pages.current = null;
    this.pages.next = null;
    this.pages.isLast = false;
    this.pages.isFirst = false;
    this.meta.cursor = cursor;
    this.updatePages();
    this.updateCursor(this.pages.current.cursor);
  }
  updatePages() {
    const cursor = Math.max(this.meta.cursor || 0, 0);
    const pages = this.pages;
    if (!pages.current) {
      if (cursor < this.content.length) {
        const current = this.layoutPageStartsWith(cursor);
        this.pagesContainer.appendChild(current.container);
        pages.current = current;
      } else {
        const current = this.layoutPageEndsWith(this.content.length);
        this.pagesContainer.appendChild(current.container);
        pages.current = current;
      }
    }
    pages.current.container.className = 'read-content-page read-content-page-current';
    pages.current.container.removeAttribute('aria-hidden');
    if (!pages.next && !pages.isLast) {
      const next = this.layoutPageStartsWith(pages.current.nextCursor);
      if (next) {
        this.pagesContainer.appendChild(next.container);
      } else {
        pages.isLast = true;
      }
      pages.next = next;
    }
    if (pages.next) {
      pages.next.container.className = 'read-content-page read-content-page-next';
      pages.next.container.setAttribute('aria-hidden', 'true');
      pages.isLast = false;
    }
    if (!pages.prev && !pages.isFirst) {
      const prev = this.layoutPageEndsWith(pages.current.cursor);
      if (prev) {
        this.pagesContainer.appendChild(prev.container);
      } else {
        pages.isFirst = true;
      }
      pages.prev = prev;
    }
    if (pages.prev) {
      pages.prev.container.className = 'read-content-page read-content-page-prev';
      pages.prev.container.setAttribute('aria-hidden', 'true');
      pages.isFirst = false;
    }
  }
  /**
   * @param {PageRender} page
   */
  disposePage(page) {
    if (!page) return;
    page.container.remove();
  }
  isTwoColumn() {
    if (window.innerWidth < 960) return false;
    if (window.innerWidth < window.innerHeight * 1.2) return false;
    return true;
  }
  step() {
    if (this.stepCache) return this.stepCache;
    const area = window.innerWidth * window.innerHeight;
    const textArea = (this.configs && this.configs.font_size || 18) ** 2;
    this.stepCache = Math.floor(area / textArea);
    return this.stepCache;
  }
  /**
   * @param {number} cursor
   * @param {HTMLElement} body
   * @returns {number}
   */
  layoutPageColumn(cursor, body) {
    // 2. fill texts until it overflow the content
    const step = this.step();
    /** @type {HTMLParagraphElement[]} */
    const paragraphs = [];
    /** @type {HTMLParagraphElement} */
    let paragraph = null;
    let isOverflow = false, after = cursor;
    while (true) {
      let pos = after;
      after += step;
      const trunk = this.content.slice(pos, after);
      if (!trunk) break;
      trunk.split(/(\n)/).forEach(line => {
        if (!paragraph) {
          paragraph = body.appendChild(document.createElement('p'));
          paragraphs.push(paragraph);
          paragraph.dataset.start = pos;
        }
        if (line === '\n') paragraph = null;
        else paragraph.textContent += line;
        pos += line.length;
      });
      if (isOverflow) break;
      if (body.clientHeight !== body.scrollHeight) {
        isOverflow = true;
      }
    }
    let nextCursor;
    if (body.clientHeight !== body.scrollHeight) {
      // 3. find out where the overflow happened
      const rect = body.getBoundingClientRect();
      const firstOut = paragraphs.slice(0).reverse().find(p => {
        return p.getBoundingClientRect().top < rect.bottom;
      });
      const startPos = Number(firstOut.dataset.start);
      const textNode = firstOut.firstChild;
      let low, high;
      if (textNode) {
        const range = document.createRange();
        low = 0;
        high = textNode.textContent.length - 1;
        while (low <= high) {
          const mid = Math.floor((low + high) / 2);
          range.setStart(textNode, mid);
          range.setEnd(textNode, mid + 1);
          if (range.getBoundingClientRect().bottom > rect.bottom) {
            high = mid - 1;
          } else {
            low = mid + 1;
          }
        }
      } else {
        low = 0;
        high = -1;
      }
      let targetHeight = null;
      if (high < 0) {
        targetHeight = firstOut.getBoundingClientRect().top - rect.top;
      } else {
        const range = document.createRange();
        range.setStart(textNode, low - 1);
        range.setEnd(textNode, low);
        targetHeight = range.getBoundingClientRect().bottom - rect.top;
      }
      nextCursor = startPos + low;
      // 4. Hide overflow content
      body.style.height = targetHeight + 'px';
      body.style.bottom = 'auto';
    } else {
      nextCursor = this.content.length;
    }
    // 5. Mark following contents hidden
    paragraphs.forEach(paragraph => {
      const start = Number(paragraph.dataset.start);
      const text = paragraph.textContent;
      const length = text.length;
      const end = start + length;
      if (start >= nextCursor) {
        paragraph.remove();
      } else if (end > nextCursor) {
        const pos = nextCursor - start;
        const before = text.slice(0, pos);
        const after = text.slice(pos);
        paragraph.textContent = before;
        const afterSpan = document.createElement('span');
        afterSpan.setAttribute('aria-hidden', 'true');
        afterSpan.textContent = after;
        paragraph.appendChild(afterSpan);
      }
    });

    return nextCursor;
  }
  /**
   * @param {number} cursor
   * @returns {PageRender}
   */
  layoutPageStartsWith(cursor) {
    if (cursor >= this.content.length) {
      return null;
    }
    const ref = template.create('readContentPage');
    const container = ref.get('root');
    const title = ref.get('title');
    const progress = ref.get('progress');
    title.textContent = this.meta.title;
    if (this.index && this.index.content && this.index.content.items) {
      const items = this.index.content.items;
      const next = items.findIndex(i => i.cursor > cursor);
      if (next === -1 && items.length) title.textContent = items[items.length - 1].title;
      else if (next > 0) title.textContent = items[next - 1].title;
    }
    progress.textContent = (cursor / this.content.length * 100).toFixed(2) + '%';
    container.lang = this.langTag;
    // 1. insert container into dom, so styles would applied to it
    this.pagesContainer.appendChild(container);

    let nextCursor;
    const body = ref.get('body');
    const left = ref.get('left');
    const right = ref.get('right');

    if (this.isTwoColumn()) {
      body.remove();
      const rightCursor = this.layoutPageColumn(cursor, left);
      nextCursor = this.layoutPageColumn(rightCursor, right);
    } else {
      left.remove();
      right.remove();
      nextCursor = this.layoutPageColumn(cursor, body);
    }

    // 5. Everything done
    this.pagesContainer.removeChild(container);
    container.classList.remove('read-content-page-processing');
    return { container, cursor, nextCursor };
  }
  /**
   * @param {number} nextCursor
   * @returns {PageRender}
   */
  layoutPageEndsWith(nextCursor) {
    if (!nextCursor) {
      return null;
    }
    const ref = template.create('readContentPage');
    const container = ref.get('root');
    this.pagesContainer.appendChild(container);
    const step = this.step();
    const content = this.content;
    container.lang = this.langTag;

    const tryFill = function (nextCursor, body) {
      let low = 0, high = nextCursor;
      while (low <= high) {
        const mid = Math.max(Math.floor((low + high) / 2), high - step);
        const trunk = content.slice(mid, nextCursor);
        body.innerHTML = '';
        trunk.split(/\n/).forEach(line => {
          const paragraph = body.appendChild(document.createElement('p'));
          paragraph.textContent += line;
        });
        const isOverflow = body.clientHeight !== body.scrollHeight;
        if (isOverflow) {
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      return low;
    };

    let prevCursor = null;
    if (this.isTwoColumn()) {
      prevCursor = tryFill(nextCursor, ref.get('right'));
      prevCursor = tryFill(prevCursor, ref.get('left'));
    } else {
      prevCursor = tryFill(nextCursor, ref.get('body'));
    }

    this.pagesContainer.removeChild(container);

    return this.layoutPageStartsWith(prevCursor);
  }
  onCursorChange(callback) {
    this.onCursorChangeCallbackList.push(callback);
  }
}

