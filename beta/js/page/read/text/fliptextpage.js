/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import onResize from '../../../ui/util/onresize.js';
import config from '../../../data/config.js';
import TextPage from './textpage.js';
import ReadPage from '../readpage.js';
import i18n from '../../../i18n/i18n.js';
import template from '../../../ui/util/template.js';
import { TouchGestureListener } from '../../../ui/util/touch.js';

/**
 * @typedef {Object} PageRender
 * @property {HTMLElement} container
 * @property {number} cursor
 * @property {number} nextCursor
 */
/**
 * @typedef {Object} PageRenderCollection
 * @property {PageRender} prev
 * @property {PageRender} current
 * @property {PageRender} next
 */

export default class FlipTextPage extends TextPage {
  /**
   * @param {ReadPage} readPage
   */
  constructor(readPage) {
    super(readPage);
  }
  async onActivate({ id }) {
    await super.onActivate({ id });

    // EXPERT_CONFIG When to use two column page
    this.screenWidthTwoColumn = await config.expert('read_flip.screen_width_two_column', 'number', 960);
    // EXPERT_CONFIG When to use two column page when side index active
    this.screenWidthTwoColumnIndex = await config.expert('read_flip.screen_width_two_column_index', 'number', 1260);
    this.maxContentLength = await config.expert('text.content_max_length', 'number', 100);

    /** @type {PageRenderCollection} */
    this.pages = {};
    window.requestAnimationFrame(() => {
      this.updatePages({ resetSpeech: true });
    });
  }
  async onInactivate() {
    await super.onInactivate();
    this.pages = null;
  }
  createContainer() {
    const container = template.create('read_text_flip');
    this.pagesContainer = container.get('pages');

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
    listener.onMoveX(wos((distance, { touch }) => {
      if (touch) this.slidePage('move', distance);
      else cancelX();
    }, cancelX));
    listener.onSlideLeft(wos(({ touch }) => {
      if (touch) this.slidePage('left');
    }, cancelX));
    listener.onSlideRight(wos(({ touch }) => {
      if (touch) this.slidePage('right');
    }, cancelX));
    listener.onCancelX(cancelX);

    const cancelY = () => { this.readPage.slideIndexPage('cancel'); };
    listener.onMoveY(wos((distance, { touch }) => {
      if (touch) this.readPage.slideIndexPage('move', distance);
      else cancelY();
    }, cancelY));
    listener.onSlideUp(wos(({ touch }) => {
      if (!touch) return;
      if (this.readPage.isIndexActive()) {
        this.readPage.slideIndexPage('hide');
      } else {
        this.readPage.showControlPage();
      }
    }, cancelY));
    listener.onSlideDown(wos(({ touch }) => {
      if (touch) this.readPage.slideIndexPage('show');
    }, cancelY));
    listener.onCancelY(cancelY);

    listener.onTouchLeft(wos(() => { this.prevPage({ resetSpeech: true }); }));
    listener.onTouchRight(wos(() => { this.nextPage({ resetSpeech: true }); }));
    listener.onTouchMiddle(wos(() => { this.readPage.showControlPage(); }));

    this.pagesContainer.addEventListener('contextmenu', event => {
      if (this.isAnythingSelected()) return;
      event.preventDefault();
      this.readPage.toggleControlPage();
    }, false);

    /** @type {HTMLButtonElement} */
    this.prevButton = container.get('prev');
    this.prevButton.title = i18n.getMessage('readPagePrevious');
    this.prevButton.addEventListener('click', () => { this.prevPage({ resetSpeech: true }); });
    /** @type {HTMLButtonElement} */
    this.nextButton = container.get('next');
    this.nextButton.title = i18n.getMessage('readPageNext');
    this.nextButton.addEventListener('click', () => { this.nextPage({ resetSpeech: true }); });

    return container.get('root');
  }
  removeContainer(container) {
    this.pagesContainer = null;
    this.prevButton = null;
    this.nextButton = null;
    container.remove();
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
  /**
   * @param {KeyboardEvent} event
   */
  keyboardEvents(event) {
    super.keyboardEvents(event);
    const current = this.readPage.activedSubpage();
    if (!current) {
      if (['PageUp', 'ArrowLeft'].includes(event.code)) {
        this.prevPage({ resetSpeech: true });
      } else if (['PageDown', 'ArrowRight'].includes(event.code)) {
        this.nextPage({ resetSpeech: true });
      } else if (['ArrowUp'].includes(event.code)) {
        this.readPage.showControlPage(true);
      } else if (['ArrowDown'].includes(event.code)) {
        this.readPage.slideIndexPage('show');
      }
    }
  }
  /**
   * @param {WheelEvent} event
   */
  wheelEvents(event) {
    super.wheelEvents(event);
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest('.read-text-pages')) return;
    if (this.wheelBusy) return;
    const deltaY = event.deltaY;
    if (!deltaY) return;
    if (deltaY > 0) this.nextPage({ resetSpeech: true });
    else if (deltaY < 0) this.prevPage({ resetSpeech: true });
    setTimeout(() => { this.wheelBusy = false; }, 250);
    this.wheelBusy = true;
  }
  /**
   * @param {'move'|'left'|'right'|'cancel'} action
   * @param {number} offset
   */
  slidePage(action, offset) {
    if (action === 'move') {
      let move = offset;
      if (offset < 0 && !this.pages.next) {
        move = Math.max(-100, offset / 2);
      } else if (offset > 0 && !this.pages.prev) {
        move = Math.min(100, offset / 2);
      }
      const [width, height] = onResize.currentSize();
      move = Math.max(-width, Math.min(width, move));
      this.pagesContainer.style.setProperty('--slide-x', move + 'px');
      this.pagesContainer.classList.add('read-text-pages-slide');
    } else {
      this.pagesContainer.style.setProperty('--slide-x', '0px');
      this.pagesContainer.classList.remove('read-text-pages-slide');
    }
    window.requestAnimationFrame(() => {
      if (action === 'left') this.nextPage({ resetSpeech: true });
      if (action === 'right') this.prevPage({ resetSpeech: true });
    });
  }
  slideCancel() {
    this.slidePage('cancel');
    this.readPage.slideIndexPage('cancel');
  }
  nextPage(config) {
    if (!this.pages.next) return;
    this.disposePage(this.pages.prev);
    this.pages.prev = this.pages.current;
    this.pages.current = this.pages.next;
    this.pages.next = null;
    this.updatePages(config);
  }
  prevPage(config) {
    if (!this.pages.prev) return;
    this.disposePage(this.pages.next);
    this.pages.next = this.pages.current;
    this.pages.current = this.pages.prev;
    this.pages.prev = null;
    this.updatePages(config);
  }
  resetPage(config) {
    this.slideCancel();
    this.stepCache = null;
    this.disposePages();
    this.updatePages(config);
  }
  updatePages(config) {
    this.updatePageBusy = true;
    const content = this.readPage.getContent();
    const cursor = this.ignoreSpaces(Math.max(this.readPage.getCursor() || 0, 0));
    const pages = this.pages;
    // Current Page
    if (!pages.current) {
      if (cursor < content.length) {
        const current = this.layoutPageStartsWith(cursor);
        // Cursor corrupted
        if (!current) { this.setCursor(0); return; }
        pages.current = current;
      } else {
        const current = this.layoutPageEndsWith(content.length);
        pages.current = current;
      }
    }
    // Active screen reader only if speech synthesis is not enabled
    const currentArticles = Array.from(pages.current.container.querySelectorAll('.read-body'));
    if (!this.readPage.isSpeaking()) {
      currentArticles.forEach(article => {
        const parent = article.parentNode;
        const placeholder = document.createElement('span');
        parent.replaceChild(placeholder, article);
        parent.replaceChild(article, placeholder);
        article.setAttribute('aria-live', 'polite');
      });
    } else {
      currentArticles.forEach(article => {
        article.removeAttribute('aria-live');
      });
    }
    // Next Page
    if (!pages.next && pages.current.nextCursor < content.length) {
      const next = this.layoutPageStartsWith(pages.current.nextCursor);
      pages.next = next;
    }
    this.nextButton.disabled = !pages.next;
    // Previous Page
    if (!pages.prev && pages.current.cursor > 0) {
      const prev = this.layoutPageEndsWith(pages.current.cursor);
      pages.prev = prev;
    }
    this.prevButton.disabled = !pages.prev;
    /** @type {('prev'|'current'|'next')[]} */
    const pageNames = ['prev', 'current', 'next'];
    pageNames.forEach(name => {
      const page = pages[name];
      if (!page) return;
      const container = page.container;
      container.classList.remove('read-text-page-prev');
      container.classList.remove('read-text-page-current');
      container.classList.remove('read-text-page-next');
      container.classList.add({
        prev: 'read-text-page-prev',
        current: 'read-text-page-current',
        next: 'read-text-page-next',
      }[name]);
      container.setAttribute('aria-hidden', name === 'current' ? 'false' : 'true');
      this.addRenderedPage(page);
    });
    this.readPage.setCursor(this.pages.current.cursor, config);
    this.updatePageBusy = false;
  }
  /** @param {PageRender} page */
  disposePage(page) {
    if (!page) return;
    page.container.remove();
  }
  disposePages() {
    this.disposePage(this.pages.prev);
    this.disposePage(this.pages.current);
    this.disposePage(this.pages.next);
    this.pages.prev = null;
    this.pages.current = null;
    this.pages.next = null;
  }
  /** @param {PageRender} page */
  addRenderedPage(page) {
    if (page.container.isConnected) return;
    this.pagesContainer.appendChild(page.container);
  }
  isTwoColumn() {
    const [width, height] = onResize.currentSize();
    if (width < this.screenWidthTwoColumn) return false;
    if (width < this.screenWidthTwoColumnIndex && this.readPage.isSideIndexActive()) return false;
    if (width < height * 1.2) return false;
    return true;
  }
  step() {
    if (this.stepCache) return this.stepCache;
    const [width, height] = onResize.currentSize();
    const area = width * height;
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
    const [pageWidth, pageHeight] = onResize.currentSize();
    const content = this.readPage.content;
    const index = this.readPage.getIndex();
    body.setAttribute('aria-setsize', content.length);
    body.setAttribute('aria-posinset', cursor);
    // 2. fill texts until it overflow the content
    const step = this.step();
    /** @type {HTMLParagraphElement[]} */
    const paragraphs = [];
    /** @type {HTMLParagraphElement} */
    let paragraph = null;
    let isOverflow = false;
    let after = this.ignoreSpaces(cursor);
    let previous = content.slice(after - this.maxContentLength, after);
    previous = previous.slice(previous.lastIndexOf('\n') + 1);
    while (body.clientHeight < pageHeight * 4) {
      let pos = after;
      after += step;
      const trunk = content.slice(pos, after);
      if (!trunk) break;
      trunk.split(/(\n)/).forEach(line => {
        if (!paragraph) {
          paragraph = body.appendChild(document.createElement('p'));
          paragraph.classList.add('text');
          paragraphs.push(paragraph);
          paragraph.dataset.start = pos;
          if (content[pos - 1] !== '\n') {
            paragraph.classList.add('text-truncated-start');
          }
          if (index && index.content && Array.isArray(index.content.items)) {
            if (index.content.items.slice(1).some(item => item.cursor === pos - previous.length)) {
              paragraph.setAttribute('role', 'heading');
              paragraph.setAttribute('aria-level', '3');
              paragraph.classList.add('text-heading');
            }
          }
        }
        if (line === '\n') {
          paragraph = null;
          previous = '';
        } else {
          paragraph.textContent += line;
          previous += line;
        }
        pos += line.length;
      });
      if (isOverflow) break;
      if (body.clientHeight !== body.scrollHeight) {
        isOverflow = true;
      }
    }
    let nextCursor;
    if (isOverflow) {
      // 3. find out where the overflow happened
      const rect = body.getBoundingClientRect();
      const firstOut = paragraphs.slice(0).reverse().find(p => {
        return p.getBoundingClientRect().top < rect.bottom;
      }) || paragraphs[0];
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
      nextCursor = content.length;
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
        // the overflowed text is still necessary here
        // as it may change the behavior of some render properties
        // `text-align: justify` for example
        const afterSpan = document.createElement('span');
        afterSpan.setAttribute('aria-hidden', 'true');
        afterSpan.textContent = after;
        paragraph.appendChild(afterSpan);
        paragraph.classList.add('text-truncated-end');
      }
    });

    return nextCursor;
  }
  /**
   * @param {number} cursor
   * @param {boolean} live
   * @returns {PageRender}
   */
  layoutPageStartsWith(cursor) {
    const content = this.readPage.getContent();
    const index = this.readPage.getIndex();
    const start = this.ignoreSpaces(cursor);
    if (start >= content.length) {
      return null;
    }
    const ref = template.create('read_text_flip_page');
    const container = ref.get('root');
    const title = ref.get('title');
    const progress = ref.get('progress');
    title.textContent = this.readPage.meta.title;
    container.dataset.title = this.readPage.meta.title;
    if (index && index.content && index.content.items) {
      const items = index.content.items;
      const next = items.findIndex(i => i.cursor > start);
      const itemIndex = next === -1 ? (items.length || 0) - 1 : next - 1;
      if (itemIndex !== -1) title.textContent = items[itemIndex].title;
      container.dataset.section = itemIndex;
    }
    progress.textContent = (start / content.length * 100).toFixed(2) + '%';
    container.lang = this.readPage.getLang();
    // 1. insert container into dom, so styles would applied to it
    this.pagesContainer.appendChild(container);

    let nextCursor;
    const body = ref.get('body');
    const left = ref.get('left');
    const right = ref.get('right');

    if (this.isTwoColumn()) {
      body.remove();
      container.classList.add('read-text-two-column');
      const rightCursor = this.layoutPageColumn(cursor, left);
      nextCursor = this.layoutPageColumn(rightCursor, right);
    } else {
      left.remove();
      right.remove();
      container.classList.add('read-text-one-column');
      nextCursor = this.layoutPageColumn(cursor, body);
    }

    // 5. Everything done
    this.pagesContainer.removeChild(container);
    container.classList.remove('read-text-page-processing');
    return { container, cursor, nextCursor };
  }
  /**
   * @param {number} nextCursor
   * @param {boolean} live
   * @returns {PageRender}
   */
  layoutPageEndsWith(nextCursor) {
    if (!nextCursor) {
      return null;
    }
    const ref = template.create('read_text_flip_page');
    const container = ref.get('root');
    this.pagesContainer.appendChild(container);
    const step = this.step();
    const content = this.readPage.getContent();
    container.lang = this.readPage.getLang();

    const tryFill = function (nextCursor, body) {
      let low = 0, high = nextCursor;
      while (low <= high) {
        const mid = Math.max(Math.floor((low + high) / 2), high - step);
        const trunk = content.slice(mid, nextCursor).replace(/\n\s*$/, '');
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

    const body = ref.get('body');
    const left = ref.get('left');

    const [target, times] = this.isTwoColumn() ? [left, 2] : [body, 1];
    const prevprev = [...Array(times + 1)].reduce(cursor => tryFill(cursor, target), nextCursor);
    const prevCursor = this.layoutPageColumn(prevprev, target);
    this.pagesContainer.removeChild(container);

    return this.layoutPageStartsWith(prevCursor);
  }
  clearHighlight() {
    Array.from(document.querySelectorAll('.read-highlight')).forEach(container => {
      container.innerHTML = '';
    });
    this.lastHighlightStart = null;
    this.lastHighlightLength = null;
  }
  highlightChars(start, length, depth = 0) {
    if (this.updatePageBusy) {
      return null;
    }
    if (this.lastHighlightStart === start) {
      if (this.lastHighlightLength === length) {
        return null;
      }
    }
    this.clearHighlight();
    if (depth > 3) return null;

    if (!this.pages.current) {
      this.readPage.setCursor(start, { resetSpeech: false });
      return this.highlightChars(start, length, depth + 1);
    }

    const prevNext = this.pages.prev ? this.pages.prev.nextCursor : void 0;
    const currentPage = this.pages.current.cursor;
    const currentNext = this.pages.current.nextCursor;
    const nextPage = this.pages.next ? this.pages.next.cursor : void 0;
    const nextNext = this.pages.next ? this.pages.next.nextCursor : void 0;

    if (start + length < Math.min(currentPage, prevNext || 0)) {
      // Maybe something went wrong
      this.readPage.setCursor(start, { resetSpeech: false });
      return this.highlightChars(start, length, depth + 1);
    }

    if (start >= nextPage) {
      if (start < nextNext) {
        this.nextPage({ resetSpeech: false });
      } else {
        this.readPage.setCursor(start, { resetSpeech: false });
      }
      return this.highlightChars(start, length, depth + 1);
    }

    this.lastHighlightStart = start;
    this.lastHighlightLength = length;

    if (start > currentNext || length === 0) {
      return [];
    }

    /** @type {HTMLElement} */
    const container = this.pages.current.container;
    const paragraphs = Array.from(container.querySelectorAll('p[data-start]'));
    const paragraph = paragraphs.reverse().find(p => p.dataset.start <= start);
    if (!paragraph) return false;
    const range = document.createRange();
    const paragraphStart = Number(paragraph.dataset.start);
    const node = paragraph.firstChild;
    if (!node) return false;

    const contentLength = node.textContent.length;
    const startPos = start - paragraphStart;
    if (startPos >= contentLength) {
      return startPos === contentLength;
    }
    const endPos = Math.min(startPos + length, contentLength);
    range.setStart(node, startPos);
    range.setEnd(node, endPos);
    const rects = Array.from(range.getClientRects());
    const highlight = container.querySelector('.read-highlight');
    const containerRect = container.getBoundingClientRect();
    const highlightSpanList = rects.map(rect => {
      const [pageWidth, pageHeight] = onResize.currentSize();
      if (rect.top > pageHeight) return null;
      if (rect.left > pageWidth) return null;
      const span = document.createElement('span');
      span.style.left = (rect.left - containerRect.left) + 'px';
      span.style.width = rect.width + 'px';
      const top = rect.top - containerRect.top;
      span.style.top = top + 'px';
      span.style.height = rect.height + 'px';
      highlight.appendChild(span);
      return span;
    });
    return highlightSpanList.filter(x => x != null).length > 0;
  }
  forceUpdate() {
    this.resetPage({ resetSpeech: true });
  }
  isInPage(cursor) {
    const current = this.pages.current;
    if (!current) return false;
    const prev = this.pages.prev;
    const prevNext = prev ? prev.nextCursor : Infinity;
    const currentCursor = current.cursor;
    if (cursor < Math.min(prevNext, currentCursor)) return false;
    const next = this.pages.next;
    const nextCursor = next ? next.cursor : 0;
    const currentNext = current.nextCursor;
    if (cursor >= Math.max(currentNext, nextCursor)) return false;
    return true;
  }
  cursorChange(cursor, config) {
    const current = this.pages.current;
    if (!current || current.cursor !== cursor) {
      this.resetPage(config);
    }
  }
  onResize() {
    super.onResize();
    this.resetPage({ resetSpeech: false });
  }
}
