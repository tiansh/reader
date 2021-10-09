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
 * @property {TrunkInfo} trunk
 */
/**
 * @typedef {Object} TrunkInfo
 * @property {HTMLDivElement} element
 * @property {ParagraphInfo[]} paragraphs
 * @property {number} start
 * @property {number} end
 * @property {number} height
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
      this.updatePage({ resetSpeech: true, resetRender: true });
    });
  }
  async onInactivate() {
    await super.onInactivate();

    this.trunks = null;
    this.activeParagraphs = null;

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

    /** @type {TrunkInfo[]} */
    this.trunks = [];
    /** @type {ParagraphInfo[]} */
    this.activeParagraphs = [];

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
        this.pageUp({ resetSpeech: true, resetRender: false });
      } else if (grid.y === 2) {
        this.pageDown({ resetSpeech: true, resetRender: false });
      } else if (grid.y === 1) {
        this.readPage.showControlPage();
      }
    });

    this.readScrollElement.addEventListener('contextmenu', event => {
      if (this.isAnythingSelected()) return;
      event.preventDefault();
      this.readPage.toggleControlPage();
    }, false);

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
        this.onScrollDone({ resetSpeech: true, resetRender: false });
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
    this.scrollToBusy = null;
    if (this.pageBusy) this.pageDone();
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
    this.scrollActive = true;
    if (this.scrollToBusy) this.abortScrollTo();
    const currentScrollTo = this.scrollToBusy = {};
    this.scrollToConfig = config;
    const oldScrollTop = container.scrollTop;
    const scrollDistance = scrollTop - oldScrollTop;
    if (!scrollDistance) return;
    this.setScrollTop(scrollTop);
    this.updatePageRender();
    body.style.top = scrollDistance + 'px';
    container.classList.add('read-body-scroll-to');
    window.requestAnimationFrame(() => {
      body.style.top = '0';
    });
    setTimeout(() => {
      if (currentScrollTo === this.scrollToBusy) {
        this.abortScrollTo();
      }
    }, this.scrollToTimeout);
  }
  removeContainer(container) {
    container.remove();

    this.readBodyElement = null;
    this.titleElement = null;
    this.progressElement = null;
    this.trunks = null;
    this.activeParagraphs = null;
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
        this.pageUp({ resetSpeech: true, resetRender: false });
      } else if (['PageDown', 'ArrowDown'].includes(event.code)) {
        this.pageDown({ resetSpeech: true, resetRender: false });
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
    if (this.pageBusy) {
      this.pagePending = 'up';
      return;
    }
    const startPosition = this.getPageStartPosition();
    const paragraph = startPosition.paragraph;
    const textNode = paragraph.element.firstChild;
    let target;
    if (textNode) {
      target = this.getTextRect(textNode, startPosition.cursor - paragraph.start).bottom;
    } else {
      target = paragraph.element.getBoundingClientRect().bottom;
    }
    const scrollTo = this.readScrollElement.scrollTop - this.readScrollElement.clientHeight + this.textRenderArea.bottom + target;
    this.pageBusy = 'up';
    this.pageTo(scrollTo, config);
  }
  pageDown(config) {
    if (this.pageBusy) {
      this.pagePending = 'down';
      return;
    }
    this.lastPageDown = performance.now();
    const endPosition = this.getPageEndPosition();
    const paragraph = endPosition.paragraph;
    const textNode = paragraph.element.firstChild;
    let target;
    if (textNode) {
      target = this.getTextRect(textNode, endPosition.cursor - paragraph.start).top;
    } else {
      target = paragraph.element.getBoundingClientRect().top;
    }
    const scrollTo = this.readScrollElement.scrollTop + target - this.textRenderArea.top;
    this.pageBusy = 'down';
    this.pageTo(scrollTo, config);
  }
  pageDone() {
    if (this.pageBusy && this.pagePending === this.pageBusy) {
      // LOG('DONE CONTINUE');
      this.readScrollElement.classList.add('read-body-scroll-fast');
    } else {
      // LOG('DONE DONE');
      this.readScrollElement.classList.remove('read-body-scroll-fast');
    }
    this.pageBusy = null;
    if (this.pagePending === 'up') {
      this.pageUp();
    } else if (this.pagePending === 'down') {
      this.pageDown();
    }
    this.pagePending = null;
  }
  pageTo(scrollTop, config) {
    this.scrollTo(scrollTop, config);
  }
  setScrollTop(scrollTop) {
    const container = this.readScrollElement;
    if (container.scrollTop !== scrollTop) {
      // LOG('Set ' + scrollTop);
      // console.log('Set ', scrollTop);
      this.lastScrollTopBefore = container.scrollTop;
      container.scrollTop = scrollTop;
    }
    this.lastScrollTop = container.scrollTop;
  }
  getParagraphs() {
    return this.trunks.flatMap(trunk => trunk.paragraphs);
  }
  getParagraphByCursor(cursor) {
    const paragraphs = this.getParagraphs();
    if (!paragraphs.length) return null;
    let low = 0, high = paragraphs.length - 1;
    if (cursor < paragraphs[low].start) return null;
    if (cursor > paragraphs[high].end) return null;
    while (true) {
      const mid = Math.floor((low + high) / 2);
      const paragraph = paragraphs[mid];
      if (cursor > paragraph.end) low = mid + 1;
      else if (cursor < paragraph.start) high = mid - 1;
      else return paragraph;
    }
  }
  clearPage() {
    // LOG('clear');
    this.readBodyElement.replaceChildren();
    this.trunks.splice(0);
    this.setScrollTop(0);
  }
  /**
   * @param {string} text
   * @param {TrunkInfo} trunk
   * @param {Object} config
   * @param {number} config.start
   * @param {number} config.end
   * @param {boolean} config.heading
   * @returns {ParagraphInfo}
   */
  renderParagraph(text, trunk, { start, end, heading }) {
    const paragraph = document.createElement('p');
    paragraph.classList.add('text');
    paragraph.dataset.start = start;
    paragraph.dataset.end = end;
    paragraph.textContent = text;
    if (heading) {
      paragraph.setAttribute('role', 'heading');
      paragraph.setAttribute('aria-level', '3');
      paragraph.classList.add('text-heading');
    }
    paragraph.setAttribute('aria-hidden', 'true');
    const info = { start, end, element: paragraph, trunk };
    trunk.element.appendChild(paragraph);
    trunk.paragraphs.push(info);
    return info;
  }
  /**
   * @param {number} start
   * @param {number} end
   * @param {HTMLElement} container
   * @returns {TrunkInfo}
   */
  renderTrunk(start, end, container) {
    const element = document.createElement('div');
    element.classList.add('read-body-trunk', 'read-body-trunk-processing');
    const trunk = { element, paragraphs: [], start, end };

    const content = this.readPage.getContent();
    const readIndex = this.readPage.readIndex;

    let contentsIndex = readIndex.getIndexOfContentsByCursor(start);
    let contents = readIndex.getContentsByIndex(contentsIndex);
    if (contents && contents.cursor < start) ++contentsIndex;

    // console.log('start: %o, end: %o', start, end);
    for (let pos = start, prev = start; pos !== end + 1; prev = ++pos) {
      pos = content.indexOf('\n', pos);
      const heading = readIndex.getContentsByIndex(contentsIndex)?.cursor === prev;
      this.renderParagraph(content.slice(prev, pos), trunk, { start: prev, end: pos, heading });
      contentsIndex += heading;
    }

    container.appendChild(element);
    trunk.height = element.clientHeight;
    element.style.height = trunk.height + 'px';
    element.classList.remove('read-body-trunk-processing');

    return trunk;
  }
  renderTrunkStartsWith(start) {
    const content = this.readPage.getContent();
    const body = this.readBodyElement;
    const end = content.indexOf('\n', start + this.step());
    const trunk = this.renderTrunk(start, end, body);
    this.trunks.push(trunk);
    return trunk;
  }
  renderTrunkEndsWith(end) {
    const content = this.readPage.getContent();
    const body = this.readBodyElement;
    const start = content.lastIndexOf('\n', end - 1 - this.step()) + 1;
    const trunk = this.renderTrunk(start, end, body);
    this.trunks.unshift(trunk);
    body.insertBefore(trunk.element, body.firstChild);
    return trunk;
  }
  getTextRect(textNode, index) {
    const range = document.createRange();
    range.setStart(textNode, index);
    range.setEnd(textNode, index + 1);
    const rects = Array.from(range.getClientRects());
    return rects.find(rect => rect.width * rect.height) ?? rects[0];
  }
  getScrollPosition(reference, useBefore) {
    // We cannot use document.elementFromPoint as certain position may belongs to margin of some paragraph
    const paragraphs = this.getParagraphs();
    if (!paragraphs || !paragraphs.length) {
      return null;
    }
    const scrollTop = reference;
    let low = 0, high = paragraphs.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const paragraph = paragraphs[mid];
      const element = paragraph.element;
      const paragraphTop = element.offsetTop + element.offsetParent.offsetTop;
      if (paragraphTop + element.clientHeight > scrollTop) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    const paragraphIndex = Math.min(low, paragraphs.length - 1);
    const current = paragraphs[paragraphIndex];
    const element = current.element;
    const currentTop = element.offsetTop + element.offsetParent.offsetTop;
    const textNode = element.firstChild;
    const length = textNode ? textNode.textContent.length : 0;
    let textLow = 0, textHigh = length - 1;
    const refY = scrollTop - currentTop + element.getBoundingClientRect().top;
    while (textLow <= textHigh) {
      const mid = Math.floor((textLow + textHigh) / 2);
      const rect = this.getTextRect(textNode, mid);
      if ((useBefore ? rect.bottom : rect.top) < refY) textLow = mid + 1;
      else textHigh = mid - 1;
    }
    const cursorOffset = useBefore ? textHigh === -1 ? -2 : textHigh : textLow === length ? textLow + 1 : textLow;
    const cursor = current.start + cursorOffset;
    const paragraph = cursor < current.start ? paragraphs[paragraphIndex - 1] : cursor > current.end ? paragraphs[paragraphIndex + 1] : current;
    const offset = cursor - paragraph.start;
    const offsetTop = reference - element.getBoundingClientRect() + element.offsetTop;

    return { paragraph, cursor, offset, offsetTop };
  }
  getPageStartPosition() {
    const top = this.textRenderArea.top - this.readBodyElement.getBoundingClientRect().top;
    return this.getScrollPosition(top, false);
  }
  getPageEndPosition() {
    const bottom = onResize.currentSize()[1] - this.readBodyElement.getBoundingClientRect().top - this.textRenderArea.bottom;
    return this.getScrollPosition(bottom, true);
  }
  getRenderCursor() {
    return this.currentRenderCursor ?? super.getRenderCursor();
  }
  getTextBufferHeight() {
    const height = Math.max(onResize.currentSize()[1], this.minimumBufferHeight);
    const textBufferHeight = height * this.textBufferSize;
    return textBufferHeight;
  }
  updatePagePrev() {
    const startTime = performance.now();
    const body = this.readBodyElement;
    const trunks = this.trunks;
    const currentTrunkIndex = this.currentTrunkIndex;
    const textBufferHeight = this.getTextBufferHeight();
    let heightChange = 0;

    // 3A. Let's render previous paragraphs
    let prevHeight = trunks.slice(0, currentTrunkIndex).reduce((height, trunk) => height + trunk.height, 0);
    const minimumHeight = textBufferHeight * (this.scrollActive ? 2 : 4);
    const targetHeight = textBufferHeight * 4;
    if (prevHeight < minimumHeight) do {
      const end = trunks[0].start - 1;
      if (end === -1) break;
      const trunk = this.renderTrunkEndsWith(end);
      prevHeight += trunk.height;
      heightChange += trunk.height;
      // Render too many trunks during scrolling will harm scroll performance
      // and cause unfriendly behavior. So we only render single trunk during
      // scrolling.
    } while (!this.scrollActive && prevHeight < targetHeight);

    // 3A. Let's remove previous paragraphs far away
    const maximumHeight = textBufferHeight * (this.scrollActive ? 12 : 8);
    const reduceHeight = textBufferHeight * 6;
    if (prevHeight > maximumHeight) while (prevHeight - trunks[0].height > reduceHeight) {
      const trunk = trunks.shift();
      prevHeight -= trunk.height;
      heightChange -= trunk.height;
      body.removeChild(trunk.element);
    }

    // if (heightChange) LOG('PREV time ' + (performance.now() - startTime));
    return heightChange;
  }
  updatePageCurrent() {
    const content = this.readPage.getContent();
    const trunks = this.trunks;

    const position = this.getPageStartPosition();
    if (position) {
      const paragraph = position.paragraph;
      this.currentTrunkIndex = trunks.indexOf(paragraph.trunk);
      this.currentRenderCursor = position.cursor;
      return this.readScrollElement.scrollTop;
    }

    this.clearPage();

    const cursor = this.readPage.getRawCursor() ?? 0;
    this.currentRenderCursor = cursor;
    const start = content.lastIndexOf('\n', cursor - 1) + 1;
    const trunk = this.renderTrunkStartsWith(start);
    this.currentTrunkIndex = 0;
    const paragraph = trunk.paragraphs[0];
    const textNode = paragraph.element.firstChild;
    if (!textNode) {
      return paragraph.element.offsetTop;
    } else {
      const rect = this.getTextRect(textNode, Math.min(start, paragraph.end - 1) - paragraph.start);
      return rect.top - trunk.element.getBoundingClientRect().top;
    }
  }
  updatePageNext() {
    const startTime = performance.now();

    const body = this.readBodyElement;
    const content = this.readPage.getContent();
    const trunks = this.trunks;
    const currentTrunkIndex = this.currentTrunkIndex;
    const textBufferHeight = this.getTextBufferHeight();
    let heightChange = 0;

    // 2A. Let's render following paragraphs
    let nextHeight = trunks.slice(currentTrunkIndex + 1).reduce((height, trunk) => height + trunk.height, 0);
    const minimumHeight = textBufferHeight * (this.scrollActive ? 6 : 10);
    const targetHeight = textBufferHeight * 10;
    if (nextHeight < minimumHeight) do {
      const start = trunks[trunks.length - 1].end + 1;
      if (start === content.length) break;
      const trunk = this.renderTrunkStartsWith(start);
      nextHeight += trunk.height;
      heightChange += trunk.height;
    } while (!this.scrollActive && nextHeight < targetHeight);

    // 2A. Let's remove following paragraphs far away
    const maximumHeight = textBufferHeight * (this.scrollActive ? 16 : 12);
    const reduceHeight = textBufferHeight * 12;
    if (nextHeight > maximumHeight) while (nextHeight - trunks[trunks.length - 1].height > reduceHeight) {
      const trunk = trunks.pop();
      nextHeight -= trunk.height;
      heightChange -= trunk.height;
      body.removeChild(trunk.element);
    }

    // if (heightChange) LOG('NEXT time ' + (performance.now() - startTime));
    return heightChange;
  }
  updatePageMeta() {
    const length = this.readPage.getContent().length;
    const cursor = this.currentRenderCursor;
    const progress = cursor / length;
    const contents = this.readPage.readIndex.getContentsByCursor(cursor);
    const title = contents?.title ?? this.readPage.getMeta().title;
    this.titleElement.textContent = title;
    this.progressElement.textContent = (progress * 100).toFixed(2) + '%';
  }
  updatePageActiveParagraphs() {
    const paragraphs = this.getParagraphs();
    const startPosition = this.getPageStartPosition();
    const firstIndex = paragraphs.indexOf(startPosition.paragraph);
    const endPosition = this.getPageEndPosition();
    const lastIndex = paragraphs.indexOf(endPosition.paragraph);
    const length = lastIndex - firstIndex + 1;
    if (this.activeParagraphs[0] === startPosition.paragraph && this.activeParagraphs.length === length) return;
    this.activeParagraphs.forEach(p => { p.element.setAttribute('aria-hidden', 'true'); });
    this.activeParagraphs = paragraphs.slice(firstIndex, lastIndex + 1);
    this.activeParagraphs.forEach(p => { p.element.setAttribute('aria-hidden', 'false'); });
    // console.log('Text: \n', this.readPage.getContent().slice(startPosition.cursor, endPosition.cursor + 1));
  }
  updatePageRender() {
    const oldScrollTop = this.updatePageCurrent();
    const prevChange = this.updatePagePrev();
    const nextChange = this.updatePageNext();
    this.updatePageMeta();
    this.updatePageActiveParagraphs();

    // if (nextChange) LOG('NEXT size ' + nextChange + ` [${this.scrollActive ? '+' : '-'}]`);
    // if (prevChange) LOG('PREV size ' + prevChange + ` [${this.scrollActive ? '+' : '-'}]`);

    const newScrollTop = oldScrollTop + prevChange;
    this.setScrollTop(newScrollTop);
  }
  async updatePage(config) {
    this.updatePageRender();
    const cursor = this.currentRenderCursor;
    if ((this.readPage.getRawCursor() ?? 0) !== cursor) {
      // console.log('Set Cursor ', cursor, config);
      this.readPage.setCursor(cursor, config);
    }
  }
  clearHighlight() {
    // TODO
  }
  highlightChars(start, length) {
    // TODO
  }
  forceUpdate() {
    this.resetPage({ resetSpeech: true, resetRender: true });
  }
  isInPage(cursor) {
    const paragraph = this.getParagraphByCursor(cursor);
    if (!paragraph) return false;
    const textNode = paragraph.element.firstChild;
    const rect = this.getTextRect(textNode, cursor - paragraph.start);
    return rect.top >= this.textRenderArea.top && rect.bottom <= this.textRenderArea.bottom;
  }
  cursorChange(cursor, config) {
    if (this.currentRenderCursor === cursor) {
      return;
    }
    const paragraph = this.getParagraphByCursor(cursor);
    if (!paragraph || config.resetRender) {
      this.resetPage(config);
    } else {
      const textNode = paragraph.element.firstChild;
      const rect = this.getTextRect(textNode, cursor - paragraph.start);
      const top = rect.top - this.textRenderArea.top;
      const scrollTop = this.readScrollElement.scrollTop;
      this.scrollTo(scrollTop + top, config);
    }
  }
  resetPage(config) {
    // LOG('reset');
    this.clearPage();
    this.currentRenderCursor = null;
    this.updatePage(config);
  }
  onResize() {
    super.onResize();
    this.resetPage({ resetSpeech: false });
  }
  step() {
    return super.step() * 2;
  }
}

// const LOG_AREA = document.body.appendChild(document.createElement('div'));
// LOG_AREA.style = 'position: fixed; top: 80px; left: 100px; right: 40px; bottom: 120px; background: #030; color: #fff; font-size: 12px; z-index: 10; overflow-y: scroll; white-space: pre-wrap; word-break: break-all;';
// const LOG = message => {
//   LOG_AREA.appendChild(document.createElement('div')).textContent = message;
//   LOG_AREA.scrollTop = LOG_AREA.scrollHeight - LOG_AREA.clientHeight;
// };

