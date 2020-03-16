import Page from './page.js';
import text from './text.js';
import file from './file.js';
import onResize from './onresize.js';
import TouchListener from './touch.js';
import config from './config.js';

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
    this.bookmarkList = document.querySelector('#read_bookmark_list');
    /** @type {HTMLTemplateElement} */
    this.bookmarkItemTemplate = document.querySelector('#read_bookmark_item_template');
    this.searchForm = document.querySelector('.search-box form');
    this.searchInput = document.querySelector('.search-input');
    this.searchList = document.querySelector('#read_search_list');
    /** @type {HTMLTemplateElement} */
    this.searchItemTemplate = document.querySelector('#read_search_item_template');
  }
  onFirstActive() {
    this.addListener();
    window.requestAnimationFrame(() => {
      this.showContent();
    });
  }
  onActive() {
    this.updatePages();
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
    this.page.jumpPage.updateCursor(cursor);
    this.page.hideBookmark();
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
    content.template = prompt('Content Template', content.template) || '';
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
    if (!this.page.index || !this.page.index.content) return;
    const items = this.page.index.content.items;
    items.forEach(item => {
      /** @type {HTMLLIElement} */
      const li = this.contentItemTemplate.content.cloneNode(true).querySelector('li');
      li.dataset.cursor = item.cursor;
      li.querySelector('h2').textContent = item.title;
      this.contentList.appendChild(li);
    });
  }
  addBookmark() {
    if (!this.page.index.bookmarks) {
      this.page.index.bookmarks = [];
    }
    const cursor = this.page.meta.cursor;
    const bookmarks = this.page.index.bookmarks;
    const next = bookmarks.find(b => b.cursor > cursor);
    const title = this.page.content.substr(cursor, 200).trim().split('\n')[0].slice(0, 50);
    const bookmark = { cursor, createTime: new Date(), title };
    if (!next) bookmarks.push(bookmark);
    else bookmarks.splice(next, 0, bookmark);
    file.setIndex(this.page.index);
    this.updateBookmarks();
  }
  updateBookmarks() {
    this.bookmarkList.innerHTML = '';
    if (!this.page.index || !this.page.index.bookmarks) return;
    const bookmarks = this.page.index.bookmarks;
    const items = this.page.index.content && this.page.index.content.items || [];
    let contentIndex = 0;
    const formatter = new Intl.DateTimeFormat(navigator.language, {
      year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric',
    });
    bookmarks.forEach(bookmark => {
      /** @type {HTMLLIElement} */
      const li = this.bookmarkItemTemplate.content.cloneNode(true).querySelector('li');
      li.dataset.cursor = bookmark.cursor;
      li.querySelector('.bookmark-text').textContent = bookmark.title;
      li.querySelector('.bookmark-time').textContent = formatter.format(bookmark.createTime);
      if (items.length) {
        while (items[contentIndex + 1] && items[contentIndex + 1].cursor <= bookmark.cursor) contentIndex++;
        li.querySelector('.bookmark-content').textContent = items[contentIndex].title;
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
        this.page.jumpPage.updateCursor(bookmark.cursor);
      });
      const remove = li.querySelector('.bookmark-remove');
      remove.addEventListener('click', () => {
        li.classList.add('bookmark-item-remove');
        const pos = bookmarks.indexOf(bookmark);
        if (pos !== -1) bookmarks.splice(pos, 1);
        file.setIndex(this.page.index);
        setTimeout(() => {
          li.remove();
        }, 100);
      });
      this.bookmarkList.appendChild(li);
    });
  }
  searchClear() {
    this.searchList.innerHTML = '';
    this.searchInput.value = '';
  }
  searchWords(word) {
    this.searchList.innerHTML = '';
    if (word === '') return;
    const lines = this.page.content.split('\n');
    let cursor = 0;
    lines.forEach(line => {
      if (line.includes(word)) {
        const index = line.indexOf(word);
        const text = line.substr(Math.max(index - 10, 0), 200).trim().slice(0, 50);

        /** @type {HTMLLIElement} */
        const li = this.searchItemTemplate.content.cloneNode(true).querySelector('li');
        li.dataset.cursor = cursor;
        const sample = li.querySelector('.sample-text');
        text.split(word).forEach((part, index) => {
          if (index !== 0) {
            sample.appendChild(document.createElement('mark')).textContent = word;
          }
          sample.appendChild(document.createTextNode(part));
        });
        this.searchList.appendChild(li);
      }
      cursor += line.length + 1;
    });
  }
}

class JumpPage {
  constructor(/** @type {HTMLElement} */jumpElement, /** @type {ReadPage} */page) {
    this.jumpElement = jumpElement;
    this.page = page;
  }
  onFirstActive() {
    this.backButton = document.querySelector('#jmup_back');
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
  onActive() {
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
  async onFirstActive() {
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

    this.bookmarkPage.onFirstActive();
    this.jumpPage.onFirstActive();

    this.customFont = document.querySelector('#custom_font');
    this.customStyle = document.querySelector('#custom_style');
  }
  async onActive({ id }) {
    this.meta = await file.getMeta(id);
    this.index = await file.getIndex(id);
    this.content = await file.content(id);

    if (!this.meta || !this.content) {
      this.gotoList();
      return;
    }

    this.pageContainer = this.containerElement.appendChild(document.createElement('div'));
    this.pageContainer.classList.add('read-pages');
    this.listenEvents();

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

    /** @type {{ prev: PageRender, current: PageRender, next: PageRender }} */
    this.pages = {};
    window.requestAnimationFrame(() => {
      this.updatePages();
      this.hideControl();
    });

    onResize.addListener(this.onResize);

    this.bookmarkPage.onActive();
    this.jumpPage.onActive();
  }
  async onUpdate({ id }) {
    this.onDeactive();
    this.onActive({ id });
  }
  async onDeactive() {
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
  listenEvents() {
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
    document.body.addEventListener('keydown', this.keyboardEvents);
  }
  keyboardEvents(event) {
    if (event.code === 'PageDown') this.nextPage();
    if (event.code === 'PageUp') this.prevPage();
    if (event.code === 'Escape') this.gotoList();
    if (event.code === 'ArrowRight') this.nextPage();
    if (event.code === 'ArrowLeft') this.prevPage();
    if (event.code === 'ArrowUp') this.showControl();
    if (event.code === 'ArrowDown') this.showBookmark();
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
    this.jumpPage.updateCursor(this.pages.current.cursor);
  }
  prevPage() {
    if (this.pages.isFirst) return;
    this.disposePage(this.pages.next);
    this.pages.next = this.pages.current;
    this.pages.current = this.pages.prev;
    this.pages.prev = null;
    this.updatePages();
    this.updateCursor(this.pages.current.cursor);
    this.jumpPage.updateCursor(this.pages.current.cursor);
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
        });
      } else {
        this.bookmarkElement.style.bottom = window.innerHeight + 'px';
        if (action === 'up') this.showControl();
      }
    }
  }
  showBookmark() {
    this.slideBookmarks('down');
  }
  hideBookmark() {
    this.bookmarkElement.style.removeProperty('bottom');
  }
  updateCursor(cursor) {
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
    window.requestAnimationFrame(() => {
      this.controlElement.style.display = 'block';
      window.requestAnimationFrame(() => {
        this.controlElement.style.opacity = '1';
      });
    });
  }
  hideControl() {
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

