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
 * @typedef {Object} ParagraphInfo
 * @property {HTMLParagraphElement} element
 * @property {number} start
 * @property {number} end
 */

export default class ScrollTextPage extends TextPage {
  /**
   * @param {ReadPage} readPage
   */
  constructor(readPage) {
    super(readPage);
  }
  async onActivate({ id }) {
    await super.onActivate({ id });

    // EXPERT_CONFIG How many pages of text rendered off-screen
    this.textBufferSize = await config.expert('appearance.text_buffer_factor', 'number', 3) || 3;
    this.minimumBufferHeight = 500;
    this.pageMoveFactor = 0.8;
    this.scrollDoneTimeout = 500;
    this.scrollToTimeout = 500;

    const outerRect = this.readScrollElement.getBoundingClientRect();
    const outerStyle = window.getComputedStyle(this.readScrollElement);
    const value = prop => Number.parseInt(outerStyle.getPropertyValue(prop), 10);
    this.textRenderArea = {
      top: outerRect.top + value('padding-top'),
      bottom: outerRect.top + value('padding-bottom'),
      left: outerRect.top + value('padding-left'),
      right: outerRect.top + value('padding-right'),
    };

    window.requestAnimationFrame(() => {
      this.updatePage({ resetSpeech: true });
    });
  }
  async onInactivate() {
    await super.onInactivate();

    this.paragraphs = null;

    this.readBodyElement = null;
    this.readScrollElement = null;
    this.titleElement = null;
    this.progressElement = null;

    this.currentScrollPosition = null;
    this.scrollActive = null;
    this.scrollToBusy = null;
  }
  createContainer() {
    const container = template.create('read_text_scroll');
    this.readBodyElement = container.get('body');
    this.readScrollElement = container.get('scroll');
    this.titleElement = container.get('title');
    this.progressElement = container.get('progress');


    this.readScrollElement.addEventListener('scroll', event => {
      this.onScroll();
    }, { passive: true, capture: true });

    /** @type {ParagraphInfo[]} */
    this.paragraphs = [];

    const listener = new TouchGestureListener(this.readScrollElement, {
      yRadian: Math.PI * 4 / 5,
      minDistanceX: 60,
      clickGridY: 3,
    });

    const startSlideX = () => {
      this.readScrollElement.classList.add('read-body-scroll-slide-x');
    };
    const stopSlideX = () => {
      this.readScrollElement.classList.remove('read-body-scroll-slide-x');
    };
    listener.onMoveX((offset, { touch }) => {
      if (!touch) return;
      startSlideX();
      if (this.isAnythingSelected()) {
        this.readPage.slideIndexPage('cancel');
      } else {
        this.readPage.slideIndexPage('move', offset);
      }
    });
    listener.onSlideLeft(({ touch }) => {
      if (!touch) return;
      stopSlideX();
      if (this.isAnythingSelected()) {
        this.readPage.slideIndexPage('cancel');
      } else if (this.readPage.isIndexActive()) {
        this.readPage.slideIndexPage('hide');
      } else {
        this.readPage.showControlPage();
      }
    });
    listener.onSlideRight(({ touch }) => {
      if (!touch) return;
      stopSlideX();
      if (this.isAnythingSelected()) {
        this.readPage.slideIndexPage('cancel');
      } else {
        this.readPage.slideIndexPage('show');
      }
    });
    listener.onCancelX(({ touch }) => {
      if (!touch) return;
      stopSlideX();
      this.readPage.slideIndexPage('cancel');
    });
    listener.onTouch(({ touch, grid }) => {
      if (grid.y === 0) {
        this.pageUp({ resetSpeech: true });
      } else if (grid.y === 2) {
        this.pageDown({ resetSpeech: true });
      } else if (grid.y === 1) {
        this.readPage.showControlPage();
      }
    });

    this.readBodyElement.addEventListener('transitionend', () => {
      // Add another raf makes transition looks better on iOS
      // I don't know why.
      window.requestAnimationFrame(() => {
        this.onScrollToEnd();
      });
    });

    return container.get('root');
  }
  // During momentum scrolling on iOS, updating `scrollTop` may be ignored due to some data hazard.
  // I have tried ~2 weeks to make it somehow looks like working.
  fixIosScrollReset() {
    if (this.scrollToBusy) return;
    let scrollTop = this.readScrollElement.scrollTop;
    const scrollDistance = Math.abs(scrollTop - this.lastScrollTop);
    if (scrollDistance < this.getTextBufferHeight()) return;
    this.setScrollTop(this.lastScrollTop);
  }
  onScroll() {
    const thisScrollEvent = this.lastScrollEvent = {};
    if (this.scrollToBusy) return;
    this.scrollActive = true;
    if (this.onScrollScheduled) return;
    this.fixIosScrollReset();
    this.onScrollScheduled = true;
    window.requestAnimationFrame(() => {
      this.onScrollScheduled = false;
      this.updatePageRender();
      setTimeout(() => {
        if (thisScrollEvent !== this.lastScrollEvent) return;
        this.scrollActive = false;
        this.onScrollDone({ resetSpeech: true });
      }, this.scrollDoneTimeout);
    });
  }
  onScrollDone(config) {
    // LOG('DONE');
    this.updatePage(config);
  }
  onScrollToEnd() {
    if (!this.scrollToBusy) return;
    const container = this.readScrollElement;
    const body = this.readBodyElement;
    container.classList.remove('read-body-scroll-to');
    body.style.top = '';
    this.scrollToBusy = false;
    this.onScrollDone(this.scrollToConfig);
  }
  abortScrollTo() {
    if (!this.scrollToBusy) return;
    const container = this.readScrollElement;
    const body = this.readBodyElement;
    const remained = Number.parseInt(window.getComputedStyle(body).top, 10);
    this.setScrollTop(container.scrollTop - remained);
    this.onScrollToEnd();
  }
  scrollTo(scrollTop, config) {
    const container = this.readScrollElement;
    const body = this.readBodyElement;
    this.scrollActive = false;
    if (this.scrollToBusy) this.abortScrollTo();
    this.scrollToConfig = config;
    const oldScrollTop = container.scrollTop;
    const scrollDistance = scrollTop - oldScrollTop;
    if (!scrollDistance) return;
    this.scrollToBusy = true;
    this.setScrollTop(scrollTop);
    this.updatePageRender();
    body.style.top = scrollDistance + 'px';
    container.classList.add('read-body-scroll-to');
    window.requestAnimationFrame(() => {
      body.style.top = '0';
    });
    setTimeout(() => {
      this.abortScrollTo();
    }, this.scrollToTimeout);
  }
  removeContainer(container) {
    container.remove();

    this.readBodyElement = null;
    this.titleElement = null;
    this.progressElement = null;
    this.paragraphs = null;
    this.currentScrollPosition = null;
    this.textRenderArea = null;
  }
  isAnythingSelected() {
    const selection = document.getSelection();
    const container = this.readScrollElement;
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
      if (['PageUp', 'ArrowUp'].includes(event.code)) {
        this.pageUp();
      } else if (['PageDown', 'ArrowDown'].includes(event.code)) {
        this.pageDown();
      } else if (['ArrowLeft'].includes(event.code)) {
        this.readPage.showControlPage();
      } else if (['ArrowRight'].includes(event.code)) {
        this.readPage.slideIndexPage('show');
      } else {
        return;
      }
      event.preventDefault();
    }
  }
  pageUp(config) {
    const height = this.readScrollElement.clientHeight - this.textRenderArea.bottom - this.textRenderArea.top;
    const factor = this.pageMoveFactor;
    this.pageTo(this.readScrollElement.scrollTop - height * factor, config);
  }
  pageDown(config) {
    const height = this.readScrollElement.clientHeight - this.textRenderArea.bottom - this.textRenderArea.top;
    const factor = this.pageMoveFactor;
    this.pageTo(this.readScrollElement.scrollTop + height * factor, config);
  }
  pageTo(scrollTop, config) {
    this.scrollTo(scrollTop, config);
  }
  getParagraphIndexByCursor(cursor) {
    const paragraphs = this.paragraphs;
    if (!paragraphs.length) return -1;
    let low = 0, high = paragraphs.length - 1;
    if (cursor < paragraphs[low].start) return -1;
    if (cursor > paragraphs[high].end) return -1;
    while (true) {
      const mid = Math.floor((low + high) / 2);
      const paragraph = paragraphs[mid];
      if (cursor > paragraph.end) low = mid + 1;
      else if (cursor < paragraph.start) high = mid - 1;
      else return mid;
    }
  }
  clearPage() {
    // LOG('clear');
    this.readBodyElement.replaceChildren();
    this.paragraphs.splice(0);
    this.setScrollTop(0);
  }
  /**
   * @param {string} content
   * @param {Object} config
   * @param {number} config.start
   * @param {number} config.end
   * @param {boolean} config.heading
   * @returns {ParagraphInfo}
   */
  renderParagraph(content, { start, end, heading }) {
    const paragraph = document.createElement('p');
    paragraph.classList.add('text');
    paragraph.dataset.start = start;
    paragraph.dataset.end = end;
    paragraph.textContent = content;
    if (heading) {
      paragraph.setAttribute('role', 'heading');
      paragraph.setAttribute('aria-level', '3');
      paragraph.classList.add('text-heading');
    }
    return { start, end, element: paragraph };
  }
  getTextRect(textNode, index) {
    const range = document.createRange();
    range.setStart(textNode, index);
    range.setEnd(textNode, index + 1);
    const rects = Array.from(range.getClientRects());
    return rects.find(rect => rect.width * rect.height) ?? rects[0];
  }
  getScrollPosition() {
    // We cannot use document.elementFromPoint as certain position may belongs to margin of some paragraph
    const paragraphs = this.paragraphs;
    if (!paragraphs || !paragraphs.length) {
      return null;
    }
    const scrollTop = this.textRenderArea.top - this.readBodyElement.getBoundingClientRect().top;
    let low = 0, high = paragraphs.length - 1;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const paragraph = paragraphs[mid];
      if (paragraph.element.offsetTop + paragraph.element.clientHeight > scrollTop) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    const current = paragraphs[low] ?? paragraphs[paragraphs.length - 1];
    const textNode = current.element.firstChild;
    const length = textNode ? textNode.textContent.length : 0;
    let textLow = 0, textHigh = length - 1;
    const topRef = scrollTop - current.element.offsetTop + current.element.getBoundingClientRect().top;
    while (textLow <= textHigh) {
      const mid = Math.floor((textLow + textHigh) / 2);
      const top = this.getTextRect(textNode, mid).top;
      if (top < topRef) textLow = mid + 1;
      else textHigh = mid - 1;
    }

    const paragraph = textLow === length ? paragraphs[low + 1] : current;
    const cursor = current.start + textLow + (textLow === length ? 1 : 0);
    const offset = textLow === length ? 0 : textLow;
    const refNode = paragraph?.element.firstChild;
    const offsetTop = refNode && this.getTextRect(refNode, offset).top - paragraph.element.getBoundingClientRect().top;

    return { paragraph, cursor, offset, offsetTop };
  }
  getRenderCursor() {
    return this.getScrollPosition()?.cursor ?? super.getRenderCursor();
  }
  getTextBufferHeight() {
    const height = Math.max(onResize.currentSize()[1], this.minimumBufferHeight);
    const textBufferHeight = height * this.textBufferSize;
    return textBufferHeight;
  }
  setScrollTop(scrollTop) {
    const container = this.readScrollElement;
    if (container.scrollTop !== scrollTop) {
      this.lastScrollTopBefore = container.scrollTop;
      container.scrollTop = scrollTop;
    }
    this.lastScrollTop = container.scrollTop;
  }
  updatePagePrev(current, prevContentsIndex) {
    // const startTime = performance.now();
    const body = this.readBodyElement;
    const content = this.readPage.getContent();
    const readIndex = this.readPage.readIndex;
    const paragraphs = this.paragraphs;
    const textBufferHeight = this.getTextBufferHeight();
    const heightBefore = body.clientHeight;

    // 3A. Let's render previous paragraphs
    const minimumHeight = body.clientHeight - current.element.offsetTop + textBufferHeight * (this.scrollActive ? 2 : 4);
    const targetHeight = body.clientHeight - current.element.offsetTop + textBufferHeight * 4;
    const newElements = [];
    if (body.clientHeight < minimumHeight) do {
      const first = paragraphs[0];
      if (first.start === 0) break;
      const end = first.start - 1;
      const start = content.lastIndexOf('\n', end - 1) + 1;
      const heading = readIndex.getContentsByIndex(prevContentsIndex)?.cursor === start;
      const paragraph = this.renderParagraph(content.slice(start, end), { start, end, heading });
      // Use appendChild and prepend later instead of insertBefore will boost its performance on iOS Safari
      // from ~500ms to ~50ms accroding to my testing
      body.appendChild(paragraph.element);
      newElements.unshift(paragraph.element);
      paragraphs.unshift(paragraph);
      if (heading) prevContentsIndex--;
    } while (body.clientHeight < targetHeight);
    body.prepend(...newElements);

    // 3A. Let's remove previous paragraph far away
    const currentTop = current.element.offsetTop;
    const maximumHeight = textBufferHeight * (this.scrollActive ? 12 : 8);
    if (currentTop > maximumHeight) {
      const allowOffset = currentTop - textBufferHeight * 6;
      const keepIndex = paragraphs.findIndex(paragraph => paragraph.element.offsetTop >= allowOffset) - 1;
      if (keepIndex > 0) {
        paragraphs.splice(0, keepIndex).forEach(paragraph => { paragraph.element.remove(); });
      }
    }

    const heightAfter = body.clientHeight;
    // if (heightAfter - heightBefore) LOG('PREV time ' + (performance.now() - startTime));
    return heightAfter - heightBefore;
  }
  updatePageCurrent(cursor) {
    const body = this.readBodyElement;
    const content = this.readPage.getContent();
    const readIndex = this.readPage.readIndex;
    const paragraphs = this.paragraphs;

    const start = content.lastIndexOf('\n', cursor - 1) + 1;
    let end = content.indexOf('\n', start + 1);
    if (end === -1) end = content.length + 1;
    const contentsIndex = readIndex.getIndexOfContentsByCursor(start);
    const contents = readIndex.getContentsByIndex(contentsIndex);
    const heading = contents?.cursor === start;
    const current = this.renderParagraph(content.slice(start, end), { start, end, heading });
    body.appendChild(current.element);
    paragraphs.push(current);

    const offset = cursor - start;
    const range = document.createRange();
    let offsetTop = 0;
    /** @type {Text} */
    const refNode = current.element.firstChild;
    if (refNode) {
      range.setStart(refNode, offset);
      range.setEnd(refNode, offset + 1);
      const rects = Array.from(range.getClientRects());
      const top = rects.find(rect => rect.width * rect.height)?.top ?? rects[0].top;
      offsetTop = top - current.element.getBoundingClientRect().top;
    }
    return { paragraph: current, cursor, offset, offsetTop };
  }
  updatePageNext(current, nextContentsIndex) {
    // const startTime = performance.now();
    const body = this.readBodyElement;
    const content = this.readPage.getContent();
    const readIndex = this.readPage.readIndex;
    const paragraphs = this.paragraphs;
    const textBufferHeight = this.getTextBufferHeight();
    const heightBefore = body.clientHeight;

    const currentBottom = current.element.offsetTop + current.element.clientHeight;
    // 2A. Let's render following paragraphs
    const minimumHeight = currentBottom + textBufferHeight * (this.scrollActive ? 3 : 6);
    const targetHeight = currentBottom + textBufferHeight * 6;
    if (body.clientHeight < minimumHeight) do {
      const last = paragraphs[paragraphs.length - 1];
      if (last.end > content.length) break;
      const start = last.end + 1;
      const end = content.indexOf('\n', start);
      const heading = readIndex.getContentsByIndex(nextContentsIndex)?.cursor === start;
      const paragraph = this.renderParagraph(content.slice(start, end), { start, end, heading });
      paragraphs.push(paragraph);
      body.appendChild(paragraph.element);
      if (heading) nextContentsIndex++;
    } while (body.clientHeight < targetHeight);

    // 2B. Let's remove any paragraphs far away
    const maximumHeight = currentBottom + textBufferHeight * 16;
    if (body.scrollHeight > maximumHeight) {
      const allowOffset = currentBottom + textBufferHeight * 12;
      while (paragraphs.length > 2) {
        const ref = paragraphs[paragraphs.length - 2];
        const bottom = ref.element.offsetTop + ref.element.clientHeight;
        if (bottom <= allowOffset) break;
        paragraphs.pop().element.remove();
      }
    }

    const heightAfter = body.clientHeight;
    // if (heightAfter - heightBefore) LOG('NEXT time ' + (performance.now() - startTime));
    return heightAfter - heightBefore;
  }
  updatePageMeta({ title, progress }) {
    this.titleElement.textContent = title;
    this.progressElement.textContent = (progress * 100).toFixed(2) + '%';
  }
  resetPage(config) {
    // LOG('reset');
    this.clearPage();
    this.currentScrollPosition = null;
    this.updatePage(config);
  }
  updatePageRender() {
    const body = this.readBodyElement;
    const readIndex = this.readPage.readIndex;
    const textBufferHeight = this.getTextBufferHeight();

    let position = this.getScrollPosition();
    let oldScrollTop = this.readScrollElement.scrollTop;

    // 1. Let's render current reading paragraph
    /** @type {number} */
    let cursor;
    /** @type {ParagraphInfo} */
    let current;
    if (position?.paragraph) {
      cursor = position.cursor;
      current = position.paragraph;
    } else {
      this.clearPage();
      cursor = this.readPage.getRawCursor() ?? 0;
      position = this.updatePageCurrent(cursor);
      current = position.paragraph;
    }

    this.currentScrollPosition = position;

    const contentsIndex = readIndex.getIndexOfContentsByCursor(current.start);
    this.updatePageMeta({
      title: readIndex.getContentsByIndex(contentsIndex)?.title ?? this.readPage.getMeta().title,
      progress: position.cursor / this.readPage.getContent().length,
    });
    const currentIsContents = readIndex.getContentsByIndex(this.contentsIndex)?.cursor === current.start;

    const nextContentsIndex = contentsIndex !== -1 ? contentsIndex + 1 : -1;
    const endingSizeChange = this.updatePageNext(current, nextContentsIndex);
    const prevContentsIndex = contentsIndex !== -1 ? contentsIndex - currentIsContents : -1;
    const startingSizeChange = this.updatePagePrev(current, prevContentsIndex);
    // if (endingSizeChange) LOG('Ending size ' + endingSizeChange + ` [${this.scrollActive ? '+' : '-'}]`);
    // if (startingSizeChange) LOG('Starting size ' + startingSizeChange + ` [${this.scrollActive ? '+' : '-'}]`);

    const newScrollTop = oldScrollTop + startingSizeChange;
    this.setScrollTop(newScrollTop);

    return cursor;
  }
  async updatePage(config) {
    const cursor = this.updatePageRender();
    if ((this.readPage.getRawCursor() ?? 0) !== cursor) {
      this.readPage.setCursor(cursor, config);
    }
  }
  clearHighlight() {
    // TODO
  }
  highlightChars(start, length, depth = 0) {
    // TODO
  }
  forceUpdate() {
    this.resetPage({ resetSpeech: true });
  }
  isInPage(cursor) {
    const paragraph = this.paragraphs[this.getParagraphIndexByCursor(cursor)];
    if (!paragraph) return false;
    const textNode = paragraph.element.firstChild;
    const rect = this.getTextRect(textNode, cursor - paragraph.start);
    return rect.top >= this.textRenderArea.top && rect.bottom <= this.textRenderArea.bottom;
  }
  cursorChange(cursor, config) {
    if (this.currentScrollPosition?.cursor === cursor) {
      return;
    }
    const paragraph = this.paragraphs[this.getParagraphIndexByCursor(cursor)];
    if (!paragraph) {
      this.resetPage(config);
    } else {
      const textNode = paragraph.element.firstChild;
      const rect = this.getTextRect(textNode, cursor - paragraph.start);
      const top = rect.top - this.textRenderArea.top;
      const scrollTop = this.readScrollElement.scrollTop;
      this.pageTo(scrollTop + top, config);
    }
  }
  onResize() {
    super.onResize();
    this.resetPage({ resetSpeech: false });
  }
}

// const LOG_AREA = document.body.appendChild(document.createElement('div'));
// LOG_AREA.style = 'position: fixed; top: 80px; left: 100px; right: 40px; bottom: 120px; background: #030; color: #fff; font-size: 12px; z-index: 10; overflow-y: scroll; white-space: pre-wrap; word-break: break-all;';
// const LOG = message => {
//   LOG_AREA.appendChild(document.createElement('div')).textContent = message;
//   LOG_AREA.scrollTop = LOG_AREA.scrollHeight - LOG_AREA.clientHeight;
// };

