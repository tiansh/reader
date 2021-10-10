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
    // EXPERT_CONFIG Width for text
    this.maxTextWidth = await config.expert('appearance.scroll_max_text_width', 'number', 0);
    this.minimumBufferHeight = 500;
    this.scrollDoneTimeout = 500;
    this.scrollToTimeout = 500;

    if (this.maxTextWidth) {
      const container = this.readScrollElement.parentNode;
      container.style.setProperty('--text-max-width', this.maxTextWidth + 'px');
    }
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
    this.highlightContainer = container.get('highlight');

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
    if (this.readScrollElement.scrollTop === this.lastScrollTop) return;
    this.scrollActive = true;
    if (this.onScrollScheduled) return;
    this.fixIosScrollReset();
    this.onScrollScheduled = true;
    window.requestAnimationFrame(() => {
      this.onScrollScheduled = false;
      this.updatePageRender();
      setTimeout(() => {
        if (thisScrollEvent !== this.lastScrollEvent) return;
        const speech = this.readPage.speech;
        this.onScrollDone({
          resetSpeech: speech.speaking && !speech.spokenInPage(),
          resetRender: false,
        });
        this.scrollActive = false;
      }, this.scrollDoneTimeout);
    });
  }
  onScrollDone(config) {
    this.updatePage(config);
  }
  onScrollToEnd() {
    if (!this.scrollToBusy) return;
    const container = this.readScrollElement;
    const body = this.readBodyElement;
    container.classList.remove('read-body-scroll-to');
    body.style.top = '';
    requestAnimationFrame(() => {
      this.scrollToBusy = null;
      if (this.pageBusy) this.pageDone();
      this.onScrollDone(this.scrollToConfig);
    });
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

    const oldScrollTop = container.scrollTop;
    const maxScrollTop = container.scrollHeight - container.clientHeight;
    const targetScrollTop = Math.max(0, Math.min(scrollTop, maxScrollTop));
    const scrollDistance = targetScrollTop - oldScrollTop;
    if (!scrollDistance) return false;

    this.scrollActive = true;
    if (this.scrollToBusy) this.abortScrollTo();
    const currentScrollTo = this.scrollToBusy = {};
    this.scrollToConfig = config;
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
    return true;
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
    const current = this.readPage.activedSubpage();
    if (!current) {
      if (['PageUp'].includes(event.code)) {
        // wrap in raf so it may have correct transition effect
        window.requestAnimationFrame(() => {
          this.pageUp({ resetSpeech: true, resetRender: false });
        });
      } else if (['PageDown'].includes(event.code)) {
        window.requestAnimationFrame(() => {
          this.pageDown({ resetSpeech: true, resetRender: false });
        });
      } else if (['ArrowLeft'].includes(event.code)) {
        this.readPage.showControlPage();
      } else if (['ArrowRight'].includes(event.code)) {
        this.readPage.slideIndexPage('show');
      } else {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    }
  }
  pageUp(config) {
    if (this.pageBusy) {
      this.pagePending = { direction: 'up', config };
      return;
    }
    const startPosition = this.getPageStartPosition();
    if (!startPosition) return;
    const paragraph = startPosition.paragraph;
    const textNode = paragraph.element.firstChild;
    let target;
    if (textNode) {
      target = this.getTextRect(textNode, startPosition.cursor - paragraph.start).bottom;
    } else {
      target = paragraph.element.getBoundingClientRect().bottom;
    }
    const scrollTo = this.readScrollElement.scrollTop - this.readScrollElement.clientHeight + this.textRenderArea.bottom + target;
    this.pageTo(scrollTo, config, 'up');
  }
  pageDown(config) {
    if (this.pageBusy) {
      this.pagePending = { direction: 'down', config };
      return;
    }
    this.lastPageDown = performance.now();
    const endPosition = this.getPageEndPosition();
    if (!endPosition) return;
    const paragraph = endPosition.paragraph;
    const textNode = paragraph.element.firstChild;
    let target;
    if (textNode) {
      target = this.getTextRect(textNode, endPosition.cursor - paragraph.start).top;
    } else {
      target = paragraph.element.getBoundingClientRect().top;
    }
    const scrollTo = this.readScrollElement.scrollTop + target - this.textRenderArea.top;
    this.pageTo(scrollTo, config, 'down');
  }
  pageDone() {
    if (this.pageBusy && this.pagePending?.direction === this.pageBusy) {
      this.readScrollElement.classList.add('read-body-scroll-fast');
    } else {
      this.readScrollElement.classList.remove('read-body-scroll-fast');
    }
    this.pageBusy = null;
    if (this.pagePending) {
      if (this.pagePending.direction === 'up') {
        this.pageUp(this.pagePending.config);
      } else if (this.pagePending.direction === 'down') {
        this.pageDown(this.pagePending.config);
      }
    }
    this.pagePending = null;
  }
  pageTo(scrollTop, config, action) {
    this.pageBusy = action;
    if (!this.scrollTo(scrollTop, config)) {
      this.pageBusy = null;
    }
  }
  setScrollTop(scrollTop) {
    const container = this.readScrollElement;
    if (container.scrollTop !== scrollTop) {
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
    this.trunks.splice(0).forEach(trunk => trunk.element.remove());
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

    for (let pos = start, prev = start; pos < end; prev = ++pos) {
      pos = content.indexOf('\n', pos);
      if (pos === -1) pos = content.length;
      const heading = readIndex.getContentsByIndex(contentsIndex)?.cursor === prev;
      this.renderParagraph(content.slice(prev, pos), trunk, { start: prev, end: pos, heading });
      contentsIndex += heading;
    }

    container.insertBefore(element, container.lastChild);
    trunk.height = element.clientHeight;
    element.style.height = trunk.height + 'px';
    element.classList.remove('read-body-trunk-processing');

    if (start === 0) {
      element.classList.add('read-body-trunk-first');
    }
    if (end === content.length) {
      element.classList.add('read-body-trunk-last');
    }

    return trunk;
  }
  renderTrunkStartsWith(start) {
    const content = this.readPage.getContent();
    const body = this.readBodyElement;
    let end = content.indexOf('\n', start + this.step());
    if (end === -1) end = content.length;
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
    if (!paragraph) return null;
    const offset = cursor - paragraph.start;
    const offsetTop = reference - element.getBoundingClientRect() + element.offsetTop;

    return { paragraph, cursor, offset, offsetTop };
  }
  getPageStartPosition() {
    const top = this.textRenderArea.top - this.readBodyElement.getBoundingClientRect().top;
    // -2 for floating point errors
    return this.getScrollPosition(top - 2, false);
  }
  getPageEndPosition() {
    const [screenWidth, screenHeight] = onResize.currentSize();
    const bottom = screenHeight - this.readBodyElement.getBoundingClientRect().top - this.textRenderArea.bottom;
    return this.getScrollPosition(bottom, true);
  }
  getRenderCursor() {
    return this.currentRenderCursor ?? super.getRenderCursor();
  }
  getTextBufferHeight() {
    const [screenWidth, screenHeight] = onResize.currentSize();
    const height = Math.max(screenHeight, this.minimumBufferHeight);
    const textBufferHeight = height * this.textBufferSize;
    return textBufferHeight;
  }
  updatePagePrev() {
    const startTime = performance.now();
    const body = this.readBodyElement;
    const trunks = this.trunks;
    const currentTrunkIndex = this.currentTrunkIndex;
    const textBufferHeight = this.getTextBufferHeight();
    let heightChange = 0, anythingChanged = false;

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
      anythingChanged = true;
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
      anythingChanged = true;
    }

    return anythingChanged ? heightChange : null;
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
    let heightChange = 0, anythingChanged = false;

    // 2A. Let's render following paragraphs
    let nextHeight = trunks.slice(currentTrunkIndex + 1).reduce((height, trunk) => height + trunk.height, 0);
    const minimumHeight = textBufferHeight * (this.scrollActive ? 6 : 10);
    const targetHeight = textBufferHeight * 10;
    if (nextHeight < minimumHeight) do {
      const start = trunks[trunks.length - 1].end + 1;
      if (start >= content.length) break;
      const trunk = this.renderTrunkStartsWith(start);
      nextHeight += trunk.height;
      heightChange += trunk.height;
      anythingChanged = true;
    } while (!this.scrollActive && nextHeight < targetHeight);

    // 2A. Let's remove following paragraphs far away
    const maximumHeight = textBufferHeight * (this.scrollActive ? 16 : 12);
    const reduceHeight = textBufferHeight * 12;
    if (nextHeight > maximumHeight) while (nextHeight - trunks[trunks.length - 1].height > reduceHeight) {
      const trunk = trunks.pop();
      nextHeight -= trunk.height;
      heightChange -= trunk.height;
      body.removeChild(trunk.element);
      anythingChanged = true;
    }

    return anythingChanged ? heightChange : null;
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
    const endPosition = this.getPageEndPosition();
    if (startPosition && endPosition) {
      const firstIndex = paragraphs.indexOf(startPosition.paragraph);
      const lastIndex = paragraphs.indexOf(endPosition.paragraph);
      const length = lastIndex - firstIndex + 1;
      if (this.activeParagraphs[0] === startPosition.paragraph && this.activeParagraphs.length === length) return;
      this.activeParagraphs.forEach(p => { p.element.setAttribute('aria-hidden', 'true'); });
      this.activeParagraphs = paragraphs.slice(firstIndex, lastIndex + 1);
      this.activeParagraphs.forEach(p => { p.element.setAttribute('aria-hidden', 'false'); });
    } else {
      this.activeParagraphs.forEach(p => { p.element.setAttribute('aria-hidden', 'true'); });
      this.activeParagraphs = [];
    }
  }
  updatePageRender() {
    const oldScrollTop = this.updatePageCurrent();
    const prevChange = this.updatePagePrev();
    const nextChange = this.updatePageNext();
    this.updatePageMeta();
    this.updatePageActiveParagraphs();
    if (prevChange != null || nextChange != null) {
      if (this.lastHighlightStart != null) this.resetHighlightChars();
    }
    const newScrollTop = oldScrollTop + (prevChange ?? 0);
    this.setScrollTop(newScrollTop);
  }
  async updatePage(config) {
    this.updatePageRender();
    const cursor = this.currentRenderCursor;
    if ((this.readPage.getRawCursor() ?? 0) !== cursor) {
      this.readPage.setCursor(cursor, config);
    }
  }
  clearHighlight() {
    this.highlightContainer.replaceChildren();
    this.lastHighlightStart = null;
    this.lastHighlightLength = null;
  }
  highlightChars(start, length, depth = 0) {
    if (this.lastHighlightStart === start) {
      if (this.lastHighlightLength === length) {
        return null;
      }
    }
    const resetAndRetry = pageDown => {
      if (this.scrollActive) return null;
      if (pageDown) this.pageDown({ resetSpeech: false, resetRender: false });
      else this.readPage.setCursor(start, { resetSpeech: false, resetRender: true });
      return this.highlightChars(start, length, depth + 1);
    };
    this.clearHighlight();
    if (depth > 3) return null;
    const paragraph = this.getParagraphByCursor(start);
    if (!paragraph) {
      if (!this.scrollToBusy) {
        return resetAndRetry(false);
      } else {
        return null;
      }
    }
    this.lastHighlightStart = start;
    this.lastHighlightLength = length;

    if (Math.min(start + length, paragraph.end) <= start) return [];
    const containerRect = this.readBodyElement.getBoundingClientRect();
    const screenHeight = onResize.currentSize()[1];
    const range = document.createRange();
    const textNode = paragraph.element.firstChild;
    range.setStart(textNode, start - paragraph.start);
    range.setEnd(textNode, Math.min(start + length, paragraph.end) - paragraph.start);
    const rects = Array.from(range.getClientRects()).filter(rect => rect.width * rect.height);
    const highlightSpanList = rects.map(rect => {
      const span = document.createElement('span');
      span.style.left = (rect.left - containerRect.left) + 'px';
      span.style.width = rect.width + 'px';
      span.style.top = (rect.top - containerRect.top) + 'px';
      span.style.height = rect.height + 'px';
      this.highlightContainer.appendChild(span);
      return span;
    });
    const firstRect = rects.find(rect => rects.every(that => that.top >= rect.top));
    if (!this.scrollToBusy) {
      // bottom is used here instead of top is expected behavior
      // Otherwise, some floating point errors may casue the page scroll up
      // when first line of text is highlighted
      if (firstRect.bottom < this.textRenderArea.top) {
        return resetAndRetry(false);
      } else if (firstRect.bottom > screenHeight - this.textRenderArea.bottom) {
        const distance = firstRect.bottom - (screenHeight - this.textRenderArea.bottom);
        if (distance > screenHeight / 2) {
          return resetAndRetry(false);
        } else {
          return resetAndRetry(true);
        }
      }
    }
    return highlightSpanList;
  }
  resetHighlightChars() {
    if (this.lastHighlightStart == null) return;
    const start = this.lastHighlightStart;
    const length = this.lastHighlightLength;
    this.clearHighlight();
    this.highlightChars(start, length);
  }
  forceUpdate() {
    this.resetPage({ resetSpeech: true, resetRender: true });
  }
  isInPage(cursor) {
    const startPosition = this.getPageStartPosition();
    if (!startPosition || cursor < startPosition.cursor) return false;
    const endPosition = this.getPageEndPosition();
    if (!endPosition || cursor > endPosition.cursor) return false;
    return true;
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
    this.clearPage();
    this.clearHighlight();
    this.currentRenderCursor = null;
    this.updatePage(config);
  }
  onResize() {
    super.onResize();
    this.resetPage({ resetSpeech: false, resetRender: true });
  }
  step() {
    return super.step() * 2;
  }
}

