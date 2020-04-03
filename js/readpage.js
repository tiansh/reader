import Page from './page.js';
import text from './text.js';
import file from './file.js';
import onResize from './onresize.js';
import TouchListener from './touch.js';
import speech from './speech.js';
import config from './config.js';
import i18n from './i18n.js';

/** @typedef {{ cursor: number, nextCursor: number, container: HTMLElement }} PageRender */

class BookmarkPage {
  constructor(/** @type {HTMLElement} */bookmarkElement, /** @type {ReadPage} */page) {
    this.container = bookmarkElement;
    this.page = page;

    this.tabGroup = this.container.querySelector('.tab-group');
    this.tabItems = [...this.container.querySelectorAll('.tab-item')];
    this.contentButton = this.tabItems[0];
    this.bookmarkButton = this.tabItems[1];
    this.searchButton = this.tabItems[2];
    this.contentPage = this.container.querySelector('#read_content_page');
    this.bookmarkPage = this.container.querySelector('#read_bookmark_page');
    this.searchPage = this.container.querySelector('#read_search_page');
    this.tabPages = [this.contentPage, this.bookmarkPage, this.searchPage];
    this.tabPageContainer = this.container.querySelector('.bookmark-tab-pages');
    this.contentRefreshButton = this.container.querySelector('#refresh_content');
    this.bookmarkAddButton = this.container.querySelector('#add_bookmark');
    this.searchClearButton = this.container.querySelector('#clear_search');
    this.headerButtons = [this.contentRefreshButton, this.bookmarkAddButton, this.searchClearButton];

    this.contentList = document.querySelector('#read_content_list');
    /** @type {HTMLTemplateElement} */
    this.contentItemTemplate = document.querySelector('#read_content_item_template');
    /** @type {HTMLTemplateElement} */
    this.contentEmptyTemplate = document.querySelector('#read_content_empty_template');
    this.bookmarkList = document.querySelector('#read_bookmark_list');
    /** @type {HTMLTemplateElement} */
    this.bookmarkItemTemplate = document.querySelector('#read_bookmark_item_template');
    /** @type {HTMLTemplateElement} */
    this.bookmarkEmptyTemplate = document.querySelector('#read_bookmark_empty_template');
    this.searchForm = document.querySelector('.search-box form');
    this.searchInput = document.querySelector('.search-input');
    this.searchList = document.querySelector('#read_search_list');
    /** @type {HTMLTemplateElement} */
    this.searchItemTemplate = document.querySelector('#read_search_item_template');
    /** @type {HTMLTemplateElement} */
    this.searchEmptyTemplate = document.querySelector('#read_search_empty_template');
    /** @type {HTMLTemplateElement} */
    this.searchInitialTemplate = document.querySelector('#read_search_initial_template');
    /** @type {HTMLTemplateElement} */
    this.searchTooManyTemplate = document.querySelector('#read_search_too_many_template');
  }
  onFirstActivate() {
    this.dateFormatter = new Intl.DateTimeFormat(navigator.language, {
      year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric',
    });
    this.addListener();
    window.requestAnimationFrame(() => {
      this.showContent();
    });
  }
  onActivate() {
    window.requestAnimationFrame(() => {
      this.updatePages();
      this.searchClear();
    });
  }
  onShow() {
  }
  updateCursor(cursor) {
    this.updateContentCursor(cursor);
    this.updateBookmarkCursor(cursor);
  }
  addListener() {
    this.contentButton.addEventListener('click', () => { this.showContent(); });
    this.bookmarkButton.addEventListener('click', () => { this.showBookmark(); });
    this.searchButton.addEventListener('click', () => { this.showSearch(); });

    const followCursor = event => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const li = target.closest('li[data-cursor]');
      if (!li) return;
      const cursor = Number(li.dataset.cursor);
      this.setCursor(cursor);
      this.page.hideBookmark();
    };

    this.contentRefreshButton.addEventListener('click', () => { this.refreshContent(); });
    this.contentList.addEventListener('click', followCursor);

    this.bookmarkAddButton.addEventListener('click', () => { this.addBookmark(); });

    this.searchClearButton.addEventListener('click', () => { this.searchClear(); });
    this.searchForm.addEventListener('submit', event => {
      this.searchWords(this.searchInput.value.trim());
      event.preventDefault();
    });
    this.searchList.addEventListener('click', followCursor);
  }
  setCursor(cursor) {
    this.page.setCursor(cursor);
  }
  showTab(button, headerButtons, page) {
    this.currentPage = page;
    this.tabItems.forEach(b => {
      if (b === button) b.classList.add('active');
      else b.classList.remove('active');
    });
    this.headerButtons.forEach(b => {
      if (headerButtons.includes(b)) b.style.display = 'inline';
      else b.style.display = 'none';
    });
    const index = this.tabPages.indexOf(page);
    this.tabPageContainer.style.setProperty('--tab-index-current', index);
    this.tabPageContainer.style.setProperty('--slide-x', '0px');
    this.tabGroup.style.setProperty('--active-index', index);
  }
  updatePages() {
    this.updateContent();
    this.updateBookmarks();
  }
  showContent() {
    this.showTab(this.contentButton, [this.contentRefreshButton], this.contentPage);
    this.updatePages();
  }
  showBookmark() {
    this.showTab(this.bookmarkButton, [this.bookmarkAddButton], this.bookmarkPage);
  }
  showSearch() {
    this.showTab(this.searchButton, [this.searchClearButton], this.searchPage);
  }
  refreshContent() {
    if (!this.page.index.content) {
      this.page.index.content = { template: '', items: [] };
    }
    const content = this.page.index.content;
    content.template = prompt(i18n.getMessage('readContentTemplate'), content.template) || '';
    if (content.template) {
      content.items = text.generateContent(this.page.content, content.template);
      content.items.unshift({ title: this.page.meta.title, cursor: 0 });
    } else {
      content.items = [];
    }
    file.setIndex(this.page.index);
    this.updateContent();
    this.updateBookmarks();
  }
  updateContent() {
    this.contentList.innerHTML = '';
    const hasContent = this.page.index && this.page.index.content;
    const items = hasContent ? this.page.index.content.items : null;
    if (hasContent && items.length) {
      items.forEach(item => {
        /** @type {HTMLLIElement} */
        const li = this.contentItemTemplate.content.cloneNode(true).querySelector('li');
        li.dataset.cursor = item.cursor;
        li.querySelector('h2').textContent = item.title;
        this.contentList.appendChild(li);
      });
      this.updateContentCursor(this.page.meta.cursor);
    } else {
      const li = this.contentEmptyTemplate.content.cloneNode(true).querySelector('li');
      this.contentList.appendChild(li);
      li.textContent = i18n.getMessage('readContentEmpty');
    }
  }
  getContentByCursor(cursor) {
    const items = this.page.index.content && this.page.index.content.items || [];
    let last = items[0];
    items.every(item => {
      if (item.cursor > cursor) return false;
      last = item;
      return true;
    });
    return last || null;
  }
  updateContentCursor(cursor) {
    const contentItem = this.getContentByCursor(cursor);
    const li = Array.from(this.contentList.querySelectorAll('li[data-cursor]'));
    li.forEach(i => {
      if (Number(i.dataset.cursor) === contentItem.cursor) {
        i.classList.add('read-content-active-item');
        if (i.offsetParent) i.offsetParent.scrollTop = i.offsetTop;
      } else i.classList.remove('read-content-active-item');
    });
  }
  addBookmark() {
    if (!this.page.index.bookmarks) {
      this.page.index.bookmarks = [];
    }
    const cursor = this.page.meta.cursor;
    const bookmarks = this.page.index.bookmarks;
    const found = bookmarks.find(b => Number(b.cursor) === cursor);
    if (!found) {
      const next = bookmarks.findIndex(b => Number(b.cursor) > cursor);
      const title = this.page.content.substr(cursor, 200).trim().split('\n')[0].slice(0, 50);
      const bookmark = { cursor, createTime: new Date(), title };
      if (next === -1) bookmarks.push(bookmark);
      else bookmarks.splice(next, 0, bookmark);
      file.setIndex(this.page.index);
    }
    this.updateBookmarks();
  }
  updateBookmarkItem(bookmark) {
    /** @type {HTMLLIElement} */
    const li = this.bookmarkItemTemplate.content.cloneNode(true).querySelector('li');
    li.dataset.cursor = bookmark.cursor;
    li.querySelector('.bookmark-text').textContent = bookmark.title;
    li.querySelector('.bookmark-time').textContent = this.dateFormatter.format(bookmark.createTime);
    const contentItem = this.getContentByCursor(bookmark.cursor);
    if (contentItem) {
      li.querySelector('.bookmark-content').textContent = contentItem.title;
    }
    let isShowMove = false;
    const showDelete = (action, offset) => {
      if (action === 'move') {
        li.classList.add('slide-bookmark-remove');
        this.bookmarkPage.classList.add('slide-bookmark-remove');
        const base = isShowMove ? offset - 120 : offset;
        const move = base > 0 ? 0 : base < -120 ? Math.max(base / 2 - 60, -130) : base;
        li.style.left = move + 'px';
      } else {
        li.classList.remove('slide-bookmark-remove');
        this.bookmarkPage.classList.remove('slide-bookmark-remove');
        window.requestAnimationFrame(() => {
          if (action === 'show') isShowMove = true;
          if (action === 'hide') isShowMove = false;
          li.style.left = isShowMove ? '-120px' : 0;
        });
      }
    };
    const content = li.querySelector('.bookmark-item-content');
    const listener = new TouchListener(content, { clickParts: 1 });
    listener.onMoveX(offset => { showDelete('move', offset); });
    listener.onCancelX(() => { showDelete('cancel'); });
    listener.onSlideLeft(() => { showDelete('show'); });
    listener.onSlideRight(() => { showDelete('hide'); });
    listener.onTouch(() => {
      this.setCursor(bookmark.cursor);
      this.page.hideBookmark();
    });
    const remove = li.querySelector('.bookmark-remove');
    remove.addEventListener('click', () => {
      li.classList.add('bookmark-item-remove');
      const bookmarks = this.page.index.bookmarks;
      const pos = bookmarks.indexOf(bookmark);
      if (pos !== -1) bookmarks.splice(pos, 1);
      file.setIndex(this.page.index);
      setTimeout(() => {
        li.remove();
      }, 100);
    });
    this.bookmarkList.appendChild(li);
  }
  updateBookmarks() {
    this.bookmarkList.innerHTML = '';
    const hasBookmarks = this.page.index && this.page.index.bookmarks;
    const bookmarks = hasBookmarks ? this.page.index.bookmarks : null;
    if (hasBookmarks && bookmarks.length) {
      bookmarks.forEach(bookmark => {
        this.updateBookmarkItem(bookmark);
      });
      this.updateBookmarkCursor(this.page.meta.cursor);
    } else {
      const li = this.bookmarkEmptyTemplate.content.cloneNode(true).querySelector('li');
      this.bookmarkList.appendChild(li);
      li.textContent = i18n.getMessage('readBookmarkEmpty');
    }
  }
  updateBookmarkCursor(cursor) {
    const li = Array.from(this.bookmarkList.querySelectorAll('li[data-cursor]'));
    let currentLi = null;
    li.forEach(i => {
      const currentCursor = Number(i.dataset.cursor);
      if (currentCursor >= cursor && !currentLi) {
        currentLi = i;
        if (currentCursor === cursor) {
          i.classList.add('read-bookmark-active-item');
          if (i.offsetParent) i.offsetParent.scrollTop = i.offsetTop - (this.contentList.clientHeight - i.clientHeight) / 2;
          return;
        } else {
          if (i.offsetParent) i.offsetParent.scrollTop = i.offsetTop - this.contentList.clientHeight / 2;
        }
      }
      i.classList.remove('read-bookmark-active-item');
    });
  }
  searchShowInitial() {
    this.searchList.innerHTML = '';
    const li = this.searchInitialTemplate.content.cloneNode(true).querySelector('li');
    this.searchList.appendChild(li);
    li.textContent = i18n.getMessage('readSearchInitial');
    li.addEventListener('click', () => { this.searchInput.focus(); });
    this.searchInput.placeholder = i18n.getMessage('readSearchPlaceholder');
  }
  searchClear() {
    this.searchInput.value = '';
    this.searchShowInitial();
  }
  searchWords(word) {
    this.searchList.innerHTML = '';
    if (word === '') return;
    const reg = new RegExp('(' + word.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + ')', 'i');
    const lines = this.page.content.split('\n'), linum = lines.length;
    let searchHit = 0;
    let cursor = 0;
    const genSearchResult = start => {
      for (let i = start; i < linum; i++) {
        const line = lines[i];
        if (reg.test(line)) {
          const index = line.match(reg).index;
          const text = line.substr(Math.max(index - 10, 0), 200).trim().slice(0, 50);

          /** @type {HTMLLIElement} */
          const li = this.searchItemTemplate.content.cloneNode(true).querySelector('li');
          li.dataset.cursor = cursor;
          const sample = li.querySelector('.sample-text');
          text.split(reg).forEach((part, index) => {
            if (index % 2 === 1) {
              sample.appendChild(document.createElement('mark')).textContent = part;
            } else {
              sample.appendChild(document.createTextNode(part));
            }
          });
          this.searchList.appendChild(li);
          searchHit++;
          if (searchHit % 1000 === 0) {
            const li = this.searchTooManyTemplate.content.cloneNode(true).querySelector('li');
            li.textContent = i18n.getMessage('readSearchTooMany', searchHit);
            li.addEventListener('click', () => {
              this.searchList.removeChild(li);
              genSearchResult(i + 1);
            });
            this.searchList.appendChild(li);
            cursor += line.length + 1;
            return;
          }
        }
        cursor += line.length + 1;
      }
    };
    genSearchResult(0);
    if (!searchHit) {
      const li = this.searchEmptyTemplate.content.cloneNode(true).querySelector('li');
      this.searchList.appendChild(li);
      li.textContent = i18n.getMessage('readSearchEmpty', word);
    }
  }
}

class JumpPage {
  constructor(/** @type {HTMLElement} */jumpElement, /** @type {ReadPage} */page) {
    this.jumpElement = jumpElement;
    this.page = page;
  }
  onFirstActivate() {
    this.backButton = document.querySelector('#jump_back');
    /** @type {HTMLElement} */
    this.container = this.jumpElement.querySelector('.jump-range-container');
    this.thumb = this.jumpElement.querySelector('.range-thumb');
    this.track = this.jumpElement.querySelector('.range-track');
    this.jumpBody = this.jumpElement.querySelector('.jump-body');
    this.addListener();
  }
  addListener() {
    this.backButton.addEventListener('click', () => {
      this.page.hideJumpPage();
    });
    const controlListener = new TouchListener(this.jumpBody, { clickParts: 1 });
    controlListener.onTouch(() => { this.page.hideJumpPage(); });
    const touchMove = clientX => {
      const width = this.track.clientWidth;
      const ratio = (clientX - 30) / width;
      this.setRatio(Math.min(Math.max(0, ratio), 1));
    };
    let mouseDown = false;
    this.container.addEventListener('touchmove', event => {
      touchMove(event.touches.item(0).clientX);
    });
    this.container.addEventListener('mousedown', event => { mouseDown = true; });
    this.container.addEventListener('mouseup', event => { mouseDown = false; });
    this.container.addEventListener('mouseleave', event => { mouseDown = false; });
    this.container.addEventListener('mousemove', event => {
      if (mouseDown) touchMove(event.clientX);
    });
    this.container.addEventListener('click', event => {
      if (event.target === this.thumb) return;
      touchMove(event.clientX);
    });
  }
  onActivate() {
    this.updateCursor(this.page.meta.cursor);
  }
  setRatio(/** @type {number} */ratio) {
    if (this.ratio === ratio) return;
    this.container.style.setProperty('--range-ratio', ratio);
    const length = this.page.content.length || 0;
    const width = this.track.clientWidth;
    const error = 1 / width;
    const fixed = ratio < error ? 0 : ratio > 1 - error ? 1 : ratio;
    const cursor = Math.round(length * fixed);
    this.page.setCursor(cursor);
    this.lastRatioDelay = this.ratio = ratio;
  }
  setRatioDelay(/** @type {number} */ratio) {
    this.lastRatioDelay = ratio;
    if (this.setterBusy) return;
    this.setterBusy = true;
    window.requestAnimationFrame(() => {
      this.setterBusy = false;
      this.setRatio(this.lastRatioDelay);
    });
  }
  updateCursor(cursor) {
    const length = this.page.content.length || cursor || 1;
    const ratio = cursor / length;
    this.container.style.setProperty('--range-ratio', ratio);
    this.ratio = ratio;
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
    const nextPage = this.page.pages.next.cursor;
    const start = ssu.data.start + event.charIndex;
    const len = Math.max(0, Math.min(event.charLength || ssu.data.end - start, nextPage - start));
    if (start > nextPage) {
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
  start() {
    if (this.speaking) return;
    this.readMoreBusy = false;
    const page = this.page;
    page.element.classList.add('read-speech');
    this.next = page.pages.current.cursor;
    if (this.spoken && this.spoken > this.next && this.spoken < page.pages.next.cursor) {
      this.next = this.spoken;
    }
    this.lastPageCursor = this.next;
    this.spoken = this.next;
    this.pendingSsu = new Set();
    ; ((async () => {
      // Safari hack, again
      while (speechSynthesis.speaking || speechSynthesis.pending) {
        speechSynthesis.cancel();
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      this.speaking = true;
      this.readMore();
    })());
  }
  stop() {
    this.page.element.classList.remove('read-speech');
    this.clearHighlight();
    this.speaking = false;
    this.pendingSsu = null;
    speechSynthesis.cancel();
  }
  reset() {
    if (!this.speaking) return;
    this.stop();
    this.start();
  }
  toggle() {
    if (this.speaking) this.stop();
    else this.start();
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
    rects.forEach(rect => {
      const span = document.createElement('span');
      ['top', 'left', 'width', 'height'].forEach(attr => {
        span.style[attr] = rect[attr] + 'px';
      });
      highlight.appendChild(span);
      return span;
    });
  }
  updateCursor(cursor) {
    if (this.speaking) {
      if (this.lastPageCursor === cursor) return;
      this.reset();
    } else {
      this.spoken = null;
    }
  }
}

export default class ReadPage extends Page {
  constructor() {
    super(document.querySelector('#read_page'));
    this.onResize = this.onResize.bind(this);
    this.keyboardEvents = this.keyboardEvents.bind(this);
  }
  matchUrl(url) {
    if (!/\/read\/\d+/.test(url)) return null;
    const id = +url.split('/').pop();
    if (!id) return null;
    return { id };
  }
  getUrl({ id }) { return '/read/' + id; }
  async onFirstActivate() {
    this.containerElement = document.querySelector('#read_page');
    this.controlElement = document.querySelector('.read-control');
    this.bookmarkElement = document.querySelector('.read-bookmark');
    this.bookmarkPage = new BookmarkPage(this.bookmarkElement, this);
    this.bookmarkBack = document.querySelector('#bookmark_back');
    /** @type {HTMLTemplateElement} */
    this.pageTemplate = document.querySelector('#read_page_container');

    this.contentButton = document.querySelector('#content_button');
    this.bookmarkButton = document.querySelector('#bookmark_button');
    this.searchButton = document.querySelector('#search_button');
    this.jumpButton = document.querySelector('#jump_button');
    this.speechButton = document.querySelector('#speech_button');

    this.jumpElement = document.querySelector('.read-jump');
    this.jumpPage = new JumpPage(this.jumpElement, this);

    this.bookmarkPage.onFirstActivate();
    this.jumpPage.onFirstActivate();

    this.customFont = document.querySelector('#custom_font');
    this.customStyle = document.querySelector('#custom_style');

    this.speech = new ReadSpeech(this);
    this.speechButton.parentNode.style.display = 'none';
    speech.getPreferVoiceAsync().then(() => {
      this.speechButton.parentNode.style.display = '';
    });

    this.backButton = document.querySelector('#read_page_back');
    this.listenEvents();
  }
  async onActivate({ id }) {
    this.meta = await file.getMeta(id);
    this.index = await file.getIndex(id);
    this.content = await file.content(id);

    if (!this.meta || !this.content) {
      this.gotoList();
      return;
    }

    await file.setMeta(this.meta);

    this.pageContainer = this.containerElement.appendChild(document.createElement('div'));
    this.pageContainer.classList.add('read-pages');
    this.listenEventsForPageContainer();

    this.layoutConfig = {
      paragraphMargin: 0,
      pageMarginX: 15,
      pageMarginY: 20,
      metaFontSize: 12,
      metaLineHeight: 20,
    };
    this.updateLayoutConfig();
    this.pageInfo = onResize.currentSize();

    await this.updateStyleConfig();

    /** @type {{ prev: PageRender, current: PageRender, next: PageRender, isLast: boolean, isFirst: boolean }} */
    this.pages = {};
    window.requestAnimationFrame(() => {
      this.hideBookmark();
      this.hideJumpPage();
      this.hideControl();
      this.updatePages();
    });

    onResize.addListener(this.onResize);

    this.bookmarkPage.onActivate();
    this.jumpPage.onActivate();
  }
  async onUpdate({ id }) {
    this.onInactivate();
    this.onActivate({ id });
  }
  async onInactivate() {
    this.meta = null;
    this.index = null;
    this.content = null;
    this.pageContainer.remove();
    this.pageContainer = null;
    this.layoutConfig = null;
    this.pageInfo = null;
    this.pages = null;
    onResize.removeListener(this.onResize);
    document.body.removeEventListener('keydown', this.keyboardEvents);
  }
  gotoList() {
    this.speech.stop();
    this.router.go('list');
  }
  onResize() {
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
  listenEventsForPageContainer() {
    const listener = new TouchListener(this.pageContainer, { yRadian: Math.PI / 6, minDistanceY: 100 });
    const wos = (f, g) => (...p) => {
      if (this.isAnythingSelected()) {
        g(...p);
      } else {
        f(...p);
      }
    };
    const cancelX = () => { this.slidePage('cancel'); };
    listener.onMoveX(wos(distance => { this.slidePage('move', distance); }, cancelX));
    listener.onCancelX(wos(cancelX, cancelX));
    listener.onSlideLeft(wos(() => { this.slidePage('left'); }, cancelX));
    listener.onSlideRight(wos(() => { this.slidePage('right'); }, cancelX));
    const cancelY = () => { this.slideBookmarks('cancel'); };
    listener.onMoveY(wos(distance => { this.slideBookmarks('move', distance); }, cancelY));
    listener.onCancelY(wos(cancelY, cancelY));
    listener.onSlideUp(wos(() => { this.slideBookmarks('up'); }, cancelY));
    listener.onSlideDown(wos(() => { this.slideBookmarks('down'); }, cancelY));
    listener.onTouchLeft(wos(() => { this.prevPage(); }));
    listener.onTouchRight(wos(() => { this.nextPage(); }));
    listener.onTouchMiddle(wos(() => { this.showControl(); }));
  }
  listenEvents() {
    const controlBody = this.controlElement.querySelector('.control-body');
    const controlListener = new TouchListener(controlBody, { clickParts: 1 });
    controlListener.onTouch(() => { this.hideControl(); });
    this.bookmarkBack.addEventListener('click', event => {
      this.hideBookmark();
    });
    this.contentButton.addEventListener('click', event => {
      this.bookmarkPage.showContent();
      this.showBookmark();
    });
    this.bookmarkButton.addEventListener('click', event => {
      this.bookmarkPage.showBookmark();
      this.showBookmark();
    });
    this.searchButton.addEventListener('click', event => {
      this.bookmarkPage.showSearch();
      this.showBookmark();
    });
    this.jumpButton.addEventListener('click', event => {
      this.showJumpPage();
    });
    this.speechButton.addEventListener('click', event => {
      this.speech.toggle();
      this.hideControl();
    });
    this.backButton.addEventListener('click', event => {
      this.gotoList();
    });
    document.body.addEventListener('keydown', this.keyboardEvents);
  }
  keyboardEvents(event) {
    if (event.code === 'Escape') {
      if (this.bookmarkShown) this.hideBookmark();
      else if (this.controlShown) this.hideControl();
      else this.gotoList();
    }
    if (event.code === 'PageDown' || event.code === 'ArrowRight') {
      if (!this.bookmarkShown && !this.controlShown) this.nextPage();
    }
    if (event.code === 'PageUp' || event.code === 'ArrowLeft') {
      if (!this.bookmarkShown && !this.controlShown) this.prevPage();
    }
    if (event.code === 'ArrowUp') {
      if (this.bookmarkShown) this.hideBookmark();
      else this.showControl();
    }
    if (event.code === 'ArrowDown') {
      if (this.controlShown) this.hideControl();
      else this.showBookmark();
    }
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
      this.pageContainer.style.setProperty('--slide-x', move + 'px');
      this.pageContainer.classList.add('read-pages-slide');
    } else {
      this.pageContainer.style.setProperty('--slide-x', '0px');
      this.pageContainer.classList.remove('read-pages-slide');
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
  /**
   * @param {'move'|'up'|'down'|'cancel'} action
   * @param {number} offset
   */
  slideBookmarks(action, offset) {
    if (action === 'move') {
      const bottom = window.innerHeight - offset;
      this.bookmarkElement.style.bottom = bottom + 'px';
      this.bookmarkElement.classList.add('slide-bookmark');
    } else {
      this.bookmarkElement.classList.remove('slide-bookmark');
      if (action === 'down') {
        window.requestAnimationFrame(() => {
          this.bookmarkElement.style.bottom = '0';
          this.bookmarkPage.onShow();
        });
      } else {
        this.bookmarkElement.style.bottom = window.innerHeight + 'px';
        if (action === 'up') this.showControl();
      }
    }
  }
  showBookmark() {
    this.bookmarkShown = true;
    this.slideBookmarks('down');
  }
  hideBookmark() {
    this.bookmarkShown = false;
    this.bookmarkElement.style.removeProperty('bottom');
  }
  updateCursor(cursor) {
    this.writeCursor(cursor);
    this.jumpPage.updateCursor(cursor);
    this.bookmarkPage.updateCursor(cursor);
    this.speech.updateCursor(cursor);
  }
  writeCursor(cursor) {
    this.meta.cursor = cursor;
    file.setMeta(this.meta);
  }
  async updateStyleConfig() {
    const keys = ['light_text', 'light_background', 'dark_text', 'dark_background', 'font_size', 'font_family', 'font_list'];
    const configs = Object.fromEntries(await Promise.all(keys.map(async key => [key, await config.get(key)])));
    const font = configs.font_family && Array.isArray(configs.font_list) &&
      configs.font_list.find(font => font.id === configs.font_family).content || null;
    this.customFont.textContent = [
      font ? `@font-face { font-family: "CustomFont"; src: url("${font}"); }` : '',
    ].join('\n');
    this.customStyle.textContent = [
      `.dark-theme .read-container { color: ${configs.dark_text}; background: ${configs.dark_background}; }`,
      `.light-theme .read-container { color: ${configs.light_text}; background: ${configs.light_background}; }`,
      `.read-container { font-size: ${configs.font_size}px; }`,
      font ? `.read-container { font-family: CustomFont; }` : '',
    ].join('\n');
  }
  updateLayoutConfig() {
    Object.keys(this.layoutConfig).forEach(key => {
      const cssKey = '--' + key.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
      const value = this.layoutConfig[key];
      const cssValue = typeof value === 'number' ? value + 'px' : value;
      document.documentElement.style.setProperty(cssKey, cssValue);
    });
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
        this.pageContainer.appendChild(current.container);
        pages.current = current;
      } else {
        const current = this.layoutPageEndsWith(this.content.length);
        this.pageContainer.appendChild(current.container);
        pages.current = current;
      }
    }
    pages.current.container.className = 'read-container read-container-current';
    if (!pages.next && !pages.isLast) {
      const next = this.layoutPageStartsWith(pages.current.nextCursor);
      if (next) {
        this.pageContainer.appendChild(next.container);
      } else {
        pages.isLast = true;
      }
      pages.next = next;
    }
    if (pages.next) {
      pages.next.container.className = 'read-container read-container-next';
      pages.isLast = false;
    }
    if (!pages.prev && !pages.isFirst) {
      const prev = this.layoutPageEndsWith(pages.current.cursor);
      if (prev) {
        this.pageContainer.appendChild(prev.container);
      } else {
        pages.isFirst = true;
      }
      pages.prev = prev;
    }
    if (pages.prev) {
      pages.prev.container.className = 'read-container read-container-prev';
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
  /**
   * @param {number} cursor
   * @returns {PageRender}
   */
  layoutPageStartsWith(cursor) {
    if (cursor >= this.content.length) {
      return null;
    }
    /** @type {HTMLElement} */
    const container = this.pageTemplate.content.firstElementChild.cloneNode(true);
    const text = container.querySelector('.read-text');
    const title = container.querySelector('.read-title');
    const progress = container.querySelector('.read-progress');
    title.textContent = this.meta.title;
    if (this.index.content && this.index.content.items) {
      const items = this.index.content.items;
      const next = items.findIndex(i => i.cursor > cursor);
      if (next === -1 && items.length) title.textContent = items[items.length - 1].title;
      else if (next > 0) title.textContent = items[next - 1].title;
    }
    progress.textContent = (cursor / this.content.length * 100).toFixed(2) + '%';
    // 1. insert container into dom, so styles would applied to it
    this.pageContainer.appendChild(container);
    // 2. fill texts until it overflow the content
    const step = 128;
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
          paragraph = text.appendChild(document.createElement('p'));
          paragraphs.push(paragraph);
          paragraph.dataset.start = pos;
        }
        if (line === '\n') paragraph = null;
        else paragraph.textContent += line;
        pos += line.length;
      });
      if (isOverflow) break;
      if (text.clientHeight !== text.scrollHeight) {
        isOverflow = true;
      }
    }
    let nextCursor;
    if (text.clientHeight !== text.scrollHeight) {
      // 3. find out where the overflow happened
      const rect = text.getBoundingClientRect();
      const firstOut = paragraphs.reverse().find(p => {
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
      text.style.height = targetHeight + 'px';
      text.style.bottom = 'auto';
    } else {
      nextCursor = this.content.length;
    }
    // 5. Everything done
    this.pageContainer.removeChild(container);
    container.classList.remove('read-container-processing');
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
    const step = 128;
    let low = 0, high = nextCursor, lastPrev = null;
    while (low <= high) {
      const mid = Math.max(Math.floor((low + high) / 2), high - step);
      const prev = this.layoutPageStartsWith(mid);
      if (prev.nextCursor < nextCursor) {
        low = mid + 1;
      } else {
        high = mid - 1;
        lastPrev = prev;
      }
    }
    return lastPrev;
  }
  showControl() {
    this.controlShown = true;
    window.requestAnimationFrame(() => {
      this.controlElement.style.display = 'block';
      window.requestAnimationFrame(() => {
        this.controlElement.style.opacity = '1';
      });
    });
  }
  hideControl() {
    this.controlShown = false;
    this.controlElement.style.opacity = '0';
    setTimeout(() => {
      this.controlElement.style.opacity = '0';
      this.controlElement.style.display = 'none';
    }, 100);
  }
  showJumpPage() {
    this.hideControl();
    this.jumpElement.style.display = 'block';
  }
  hideJumpPage() {
    this.jumpElement.style.display = 'none';
  }
}

