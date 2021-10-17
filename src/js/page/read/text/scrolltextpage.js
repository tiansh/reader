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
import template from '../../../ui/util/template.js';
import { TouchGestureListener } from '../../../ui/util/touch.js';
import i18n from '../../../i18n/i18n.js';

/**
 * @typedef {Object} ParagraphInfo
 * @property {HTMLParagraphElement} element    paragraph element
 * @property {number} start                    start cursor of paragraph
 * @property {number} end                      end cursor of paragraph
 * @property {TrunkInfo} trunk                 the trunk paragraph belongs to
 * @property {number} height                   height in pixel
 * @property {number} offsetTop                offsetTop relative to trunk
 * @property {ParagraphInfo} prev              previous praagraph
 * @property {ParagraphInfo} next              next paragraph
 */
/**
 * @typedef {Object} TrunkInfo
 * @property {HTMLDivElement} element    trunk element
 * @property {ParagraphInfo[]}           paragraphs    paragraphs of this trunk
 * @property {number} start              start cursor of trunk
 * @property {number} end                end cursor of trunk
 * @property {number} height             height in pixel
 * @property {number} offsetTop          offsetTop relative to scroll body
 * @property {TrunkInfo} prev            previous trunk
 * @property {TrunkInfo} next            next trunk
 */

export default class ScrollTextPage extends TextPage {
  /**
   * @param {ReadPage} readPage
   */
  constructor(readPage) {
    super(readPage);

    this.autoScrollOnVisibilityChange = this.autoScrollOnVisibilityChange.bind(this);
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
    this.updateMetaTimeout = 250;
    this.doubleTapTimeout = 400;
    this.readSpeedBase = 20.0;
    this.readSpeedFactorMin = 0.1;
    this.readSpeedFactorMax = 20;

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

    this.autoScrollStop();
    this.autoScrollSpeedFactor = null;
  }
  createContainer() {
    const container = template.create('read_text_scroll');
    this.readBodyElement = container.get('body');
    this.readScrollElement = container.get('scroll');
    this.titleElement = container.get('title');
    this.progressElement = container.get('progress');
    this.highlightContainer = container.get('highlight');
    this.autoScrollCover = container.get('cover');

    this.autoScrollCover.setAttribute('aria-label', i18n.getMessage('readAutoScrollStop'));

    this.readScrollElement.addEventListener('scroll', event => {
      this.onScroll();
    }, { passive: true, capture: true });

    /** @type {TrunkInfo[]} */
    this.trunks = [];
    console.log(this.trunks);
    /** @type {ParagraphInfo[]} */
    this.activeParagraphs = [];

    const listener = new TouchGestureListener(this.readScrollElement, {
      yRadian: Math.PI * 4 / 5,
      minDistanceX: 60,
      clickGridY: 3,
    });

    const startSlideX = () => {
      if (this.scrollToBusy) this.abortScrollTo();
      this.readScrollElement.classList.add('read-body-scroll-slide-x');
      if (this.scrollActive) this.onScrollDone();
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
      if (this.autoScrollBusy()) return;
      this.touchCount = (this.touchCount ?? 0) + 1;
      if (grid.y === 0) {
        this.pageUp({ resetSpeech: true, resetRender: false });
      } else if (grid.y === 2) {
        this.pageDown({ resetSpeech: true, resetRender: false });
      } else if (grid.y === 1) {
        this.readPage.showControlPage();
        this.justShowControlPage = true;
        setTimeout(() => { this.justShowControlPage = false; }, this.doubleTapTimeout);
      }
    });

    this.readScrollElement.addEventListener('contextmenu', event => {
      if (this.isAnythingSelected()) return;
      if (this.autoScrollRunning) return;
      event.preventDefault();
      this.readPage.toggleControlPage();
    }, false);

    this.readScrollElement.addEventListener('dblclick', event => {
      const posY = event.clientY / this.readScrollElement.clientHeight;
      if (Math.floor(posY * 3) !== 1) return;
      this.readPage.hideControlPage();
      this.autoScrollStart();
    });

    this.readBodyElement.addEventListener('transitionend', () => {
      // Add another raf makes transition looks better on iOS
      // I don't know why.
      window.requestAnimationFrame(() => {
        this.onScrollToEnd();
      });
    });

    const coverListener = new TouchGestureListener(this.autoScrollCover, { clickGridY: 3 });
    coverListener.onStart(() => {
      if (!this.autoScrollRunning) return;
      this.autoScrollSpeedFactorOld = this.autoScrollSpeedFactor;
    });
    coverListener.onMoveY(offset => {
      if (!this.autoScrollRunning) return;
      const [screenWidth, screenHeight] = onResize.currentSize();
      const smallMove = Math.abs(offset) > coverListener.minDistanceY;
      const factor = smallMove ? (1 / 16) ** (offset / screenHeight) : 1;
      const speedFactor = this.autoScrollSpeedFactorOld * factor;
      this.autoScrollUpdate({ speedFactor });
    });
    coverListener.onEnd(() => {
      if (!this.autoScrollRunning) return;
      this.autoScrollSpeedFactorOld = null;
    });
    coverListener.onTouch(({ grid }) => {
      if (!this.autoScrollRunning) return;
      if (grid.y === 0) {
        this.autoScrollStop({ paging: true });
        this.pageUp({ resetSpeech: true, resetRender: false });
      } else if (grid.y === 1) {
        this.autoScrollStop();
      } else {
        this.autoScrollStop({ paging: true });
        this.pageDown({ resetSpeech: true, resetRender: false });
      }
    });
    this.autoScrollCover.addEventListener('wheel', event => {
      if (!this.autoScrollRunning) return;
      const [screenWidth, screenHeight] = onResize.currentSize();
      const factor = 2 ** (event.deltaY / screenHeight);
      const speedFactor = this.autoScrollSpeedFactor * factor;
      this.autoScrollUpdate({ speedFactor });
    }, { passive: true });

    /** @type {HTMLButtonElement} */
    this.prevButton = container.get('prev');
    this.prevButton.title = i18n.getMessage('readPageScrollUp');
    this.prevButton.addEventListener('click', () => {
      this.pageUp({ resetSpeech: true, resetRender: false });
    });
    /** @type {HTMLButtonElement} */
    this.nextButton = container.get('next');
    this.nextButton.title = i18n.getMessage('readPageScrollDown');
    this.nextButton.addEventListener('click', () => {
      this.pageDown({ resetSpeech: true, resetRender: false });
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
      this.updatePage({ resetSpeech: false, resetRender: false, debug: true });
      setTimeout(() => {
        if (thisScrollEvent !== this.lastScrollEvent) return;
        const speech = this.readPage.speech;
        this.onScrollDone({
          resetSpeech: speech.speaking && !speech.spokenInPage(),
          resetRender: false,
        });
      }, this.scrollDoneTimeout);
    });
  }
  onScrollDone(config) {
    this.scrollActive = false;
    this.updatePage(config);
  }
  onScrollToEnd() {
    if (!this.scrollToBusy) return;
    const container = this.readScrollElement;
    const body = this.readBodyElement;
    container.classList.remove('read-body-scroll-to');
    body.style.top = '';
    const currentScrollTo = this.scrollToBusy;
    requestAnimationFrame(() => {
      if (this.pageBusy) this.pageDone();
      this.onScrollDone(this.scrollToConfig);
      if (currentScrollTo === this.scrollToBusy) this.scrollToBusy = null;
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
    if (this.autoScrollRunning) return false;
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
      if (['PageUp', 'PageDown'].includes(event.code)) {
        // wrap in raf so it may have correct transition effect
        window.requestAnimationFrame(() => {
          if (this.autoScrollRunning) {
            this.autoScrollStop({ paging: true });
            if (event.code === 'PageUp') {
              this.pageUp({ resetSpeech: true, resetRender: false });
            } else {
              this.pageDown({ resetSpeech: true, resetRender: false });
            }
          } else if (!this.autoScrollBusy()) {
            if (event.code === 'PageUp') {
              this.pageUp({ resetSpeech: true, resetRender: false });
            } else {
              this.pageDown({ resetSpeech: true, resetRender: false });
            }
          }
        });
      } else if (['ArrowLeft'].includes(event.code)) {
        if (!this.autoScrollRunning && !this.autoScrollPaging) {
          this.readPage.showControlPage();
        }
      } else if (['ArrowRight'].includes(event.code)) {
        if (!this.autoScrollRunning && !this.autoScrollPaging) {
          this.readPage.slideIndexPage('show');
        }
      } else if (['ArrowUp', 'ArrowDown'].includes(event.code)) {
        if (this.autoScrollRunning) {
          const pow = event.code === 'ArrowUp' ? -1 : 1;
          const speedFactor = this.autoScrollSpeedFactor * 1.1 ** pow;
          this.autoScrollUpdate({ speedFactor });
        }
      } else if (['Home', 'End'].includes(event.code)) {
        // do nothing
      } else if (['Escape'].includes(event.code) && this.autoScrollBusy()) {
        this.autoScrollStop();
      } else {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    }
  }
  /**
   * @param {MouseEvent} event
   */
  mouseEvents(event) {
    if (this.useMouseClickPaging && event.buttons === 8) {
      this.pageUp({ resetSpeech: true, resetRender: false });
    } else if (this.useMouseClickPaging && event.buttons === 16) {
      this.pageDown({ resetSpeech: true, resetRender: false });
    } else {
      return;
    }
    event.preventDefault();
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
    if (!this.pageBusy) {
      if (this.autoScrollPaging) {
        this.autoScrollStart();
      }
    }
  }
  pageTo(scrollTop, config, action) {
    this.pageBusy = action;
    if (!this.scrollTo(scrollTop, config)) {
      this.pageBusy = null;
    }
  }
  setScrollTop(scrollTop) {
    const container = this.readScrollElement;
    const target = scrollTop;
    if (Math.abs(container.scrollTop - target) > 0.5) {
      container.scrollTop = target;
    }
    this.lastScrollTop = container.scrollTop;
  }
  getParagraphByCursor(cursor) {
    /**
     * @template {TrunkInfo|ParagraphInfo} T
     * @param {T[]} items
     * @returns {T}
     */
    const findByCursor = items => {
      let low = 0, high = items.length - 1;
      if (!items.length) return null;
      if (cursor < items[low].start) return null;
      if (cursor > items[high].end) return null;
      while (true) {
        const mid = Math.floor((low + high) / 2);
        const item = items[mid];
        if (cursor > item.end) low = mid + 1;
        else if (cursor < item.start) high = mid - 1;
        else return item;
      }
    };
    const trunk = findByCursor(this.trunks);
    return trunk && findByCursor(trunk.paragraphs);
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
    trunk.element.appendChild(paragraph);
    const info = { start, end, element: paragraph, trunk, prev: null, next: null };
    if (trunk.paragraphs.length) {
      info.prev = trunk.paragraphs[trunk.paragraphs.length - 1];
      trunk.paragraphs[trunk.paragraphs.length - 1].next = info;
    }
    trunk.paragraphs.push(info);
    return info;
  }
  updateTrunkOffsetTop() {
    let offsetTop = 0;
    this.trunks.forEach(trunk => {
      trunk.offsetTop = offsetTop;
      offsetTop += trunk.height;
    });
  }
  /**
   * @param {number} start
   * @param {number} end
   * @param {'first'|'last'} position
   * @returns {TrunkInfo}
   */
  renderTrunk(start, end, position) {
    const content = this.readPage.getContent();
    const readIndex = this.readPage.readIndex;

    const element = document.createElement('div');
    /** @type {TrunkInfo} */
    const trunk = { element, paragraphs: [], start, end };

    element.classList.add('trunk', 'trunk-processing');
    element.dataset.start = start;
    element.dataset.end = end;
    if (start === 0) element.classList.add('trunk-first');
    if (end === content.length) element.classList.add('trunk-last');

    let contentsIndex = readIndex.getIndexOfContentsByCursor(start);
    if (contentsIndex === 0) contentsIndex = 1;
    let contents = readIndex.getContentsByIndex(contentsIndex);
    if (contents && contents.cursor < start) ++contentsIndex;

    for (let pos = start, prev = start; pos < end; prev = ++pos) {
      pos = content.indexOf('\n', pos);
      if (pos === -1) pos = content.length;
      const heading = readIndex.getContentsByIndex(contentsIndex)?.cursor === prev;
      this.renderParagraph(content.slice(prev, pos), trunk, { start: prev, end: pos, heading });
      contentsIndex += heading;
    }

    const body = this.readBodyElement;
    const reference = position === 'first' ? body.firstChild : body.lastChild;
    body.insertBefore(element, reference);
    const rect = element.getBoundingClientRect();
    trunk.height = Math.round(rect.height * 1000) / 1000;
    trunk.paragraphs.forEach(paragraph => {
      const paragraphRect = paragraph.element.getBoundingClientRect();
      paragraph.height = Math.round(paragraphRect.height * 1000) / 1000;
      paragraph.offsetTop = Math.round((paragraphRect.top - rect.top) * 1000) / 1000;
    });
    element.style.height = trunk.height + 'px';
    element.classList.remove('trunk-processing');

    if (position === 'first') {
      if (this.trunks.length) {
        const oldFirst = this.trunks[0];
        trunk.next = oldFirst;
        oldFirst.prev = trunk;
        const oldFirstParagraph = oldFirst.paragraphs[0];
        const firstLastParagraph = trunk.paragraphs[trunk.paragraphs.length - 1];
        firstLastParagraph.next = oldFirstParagraph;
        oldFirstParagraph.prev = firstLastParagraph;
      }
      this.trunks.unshift(trunk);
    } else {
      if (this.trunks.length) {
        const oldLast = this.trunks[this.trunks.length - 1];
        trunk.prev = oldLast;
        oldLast.next = trunk;
        const oldLastParagraph = oldLast.paragraphs[oldLast.paragraphs.length - 1];
        const lastFirstParagraph = trunk.paragraphs[0];
        oldLastParagraph.next = lastFirstParagraph;
        lastFirstParagraph.prev = oldLastParagraph;
      }
      this.trunks.push(trunk);
    }
    this.updateTrunkOffsetTop();

    return trunk;
  }
  /**
   * @param {'first'|'last'} position
   */
  removeTrunk(position) {
    if (this.trunks.length === 0) return null;
    const trunk = position === 'first' ? this.trunks.shift() : this.trunks.pop();
    trunk.element.remove();
    if (trunk.next) {
      const next = trunk.next;
      trunk.next = null;
      next.prev = null;
      trunk.paragraphs[trunk.paragraphs.length - 1].next = null;
      next.paragraphs[0].prev = null;
    }
    if (trunk.prev) {
      const prev = trunk.prev;
      trunk.prev = null;
      prev.next = null;
      trunk.paragraphs[0].prev = null;
      prev.paragraphs[prev.paragraphs.length - 1].next = null;
    }
    if (position === 'first') {
      this.updateTrunkOffsetTop();
    }
    return trunk;
  }
  /**
   * @param {number} start
   * @param {'first'|'last'} position
   */
  renderTrunkStartsWith(start, position) {
    const content = this.readPage.getContent();
    let end = content.indexOf('\n', start + this.step());
    if (end === -1) end = content.length;
    const trunk = this.renderTrunk(start, end, position);
    return trunk;
  }
  /**
   * @param {number} start
   * @param {'first'|'last'} position
   */
  renderTrunkEndsWith(end, position) {
    const content = this.readPage.getContent();
    const start = content.lastIndexOf('\n', end - 1 - this.step()) + 1;
    const trunk = this.renderTrunk(start, end, position);
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
    const trunks = this.trunks;
    const trunk = trunks.reduce((choose, trunk) => {
      const offset = trunk.offsetTop + this.textRenderArea.top;
      if (useBefore && offset <= reference) return trunk;
      else if (choose) return choose;
      else if (!useBefore && offset + trunk.height >= reference) return trunk;
      else return null;
    }, null);
    if (!trunk?.paragraphs?.length) return null;
    const paragraphs = trunk.paragraphs;
    const scrollTop = reference;
    let low = 0, high = paragraphs.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const paragraph = paragraphs[mid];
      const element = paragraph.element;
      const paragraphTop = paragraph.offsetTop + paragraph.trunk.offsetTop;
      if (paragraphTop + paragraph.height > scrollTop) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    const paragraphIndex = Math.min(low, paragraphs.length - 1);
    const current = paragraphs[paragraphIndex];
    const element = current.element;
    const currentTop = current.offsetTop + current.trunk.offsetTop;
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
    let paragraph = current;
    if (cursor < current.start) paragraph = paragraph.prev;
    else if (cursor > current.end) paragraph = paragraph.next;
    if (!paragraph) return null;
    const offset = cursor - paragraph.start;

    return { paragraph, cursor, offset };
  }
  getPageStartPosition() {
    const bodyRect = this.readBodyElement.getBoundingClientRect();
    const top = this.textRenderArea.top - bodyRect.top;
    // -2 for floating point errors
    return this.getScrollPosition(top - 2, false);
  }
  getPageEndPosition() {
    const [screenWidth, screenHeight] = onResize.currentSize();
    const bodyRect = this.readBodyElement.getBoundingClientRect();
    const bottom = screenHeight - bodyRect.top - this.textRenderArea.bottom;
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
    const trunks = this.trunks;
    const textBufferHeight = this.getTextBufferHeight();
    let heightChange = 0, anythingChanged = false;

    // 3A. Let's render previous paragraphs
    let prevHeight = this.currentTrunk.offsetTop;
    const minimumHeight = textBufferHeight * (this.scrollActive ? 2 : 4);
    const targetHeight = textBufferHeight * 4;
    if (prevHeight < minimumHeight) do {
      const end = trunks[0].start - 1;
      if (end === -1) break;
      const trunk = this.renderTrunkEndsWith(end, 'first');
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
      const trunk = this.removeTrunk('first');
      prevHeight -= trunk.height;
      heightChange -= trunk.height;
      anythingChanged = true;
    }

    return anythingChanged ? heightChange : null;
  }
  updatePageCurrent() {
    const content = this.readPage.getContent();

    const position = this.getPageStartPosition();
    if (position) {
      const paragraph = position.paragraph;
      this.currentTrunk = paragraph.trunk;
      this.currentRenderCursor = position.cursor;
      return this.readScrollElement.scrollTop;
    }

    this.clearPage();

    const cursor = this.readPage.getRawCursor() ?? 0;
    this.currentRenderCursor = cursor;
    const start = content.lastIndexOf('\n', cursor - 1) + 1;
    const trunk = this.renderTrunkStartsWith(start, 'first');
    this.currentTrunk = trunk;
    const paragraph = trunk.paragraphs[0];
    const textNode = paragraph.element.firstChild;
    if (!textNode) {
      return paragraph.offsetTop;
    } else {
      const rect = this.getTextRect(textNode, Math.min(cursor, paragraph.end - 1) - paragraph.start);
      return rect.top - trunk.element.getBoundingClientRect().top;
    }
  }
  updatePageNext() {
    const body = this.readBodyElement;
    const content = this.readPage.getContent();
    const trunks = this.trunks;
    const textBufferHeight = this.getTextBufferHeight();
    let heightChange = 0, anythingChanged = false;

    // 2A. Let's render following paragraphs
    const lastTrunk = trunks[trunks.length - 1];
    let nextHeight = lastTrunk.offsetTop + lastTrunk.height - (this.currentTrunk.offsetTop + this.currentTrunk.height);
    const minimumHeight = textBufferHeight * (this.scrollActive ? 6 : 10);
    const targetHeight = textBufferHeight * 10;
    if (nextHeight < minimumHeight) do {
      const start = trunks[trunks.length - 1].end + 1;
      if (start >= content.length) break;
      const trunk = this.renderTrunkStartsWith(start, 'last');
      nextHeight += trunk.height;
      heightChange += trunk.height;
      anythingChanged = true;
    } while (!this.scrollActive && nextHeight < targetHeight);

    // 2A. Let's remove following paragraphs far away
    const maximumHeight = textBufferHeight * (this.scrollActive ? 16 : 12);
    const reduceHeight = textBufferHeight * 12;
    if (nextHeight > maximumHeight) while (nextHeight - trunks[trunks.length - 1].height > reduceHeight) {
      const trunk = this.removeTrunk('last');
      nextHeight -= trunk.height;
      heightChange -= trunk.height;
      body.removeChild(trunk.element);
      anythingChanged = true;
    }

    return anythingChanged ? heightChange : null;
  }
  updatePageMeta() {
    this.lastMeta = performance.now();
    const length = this.readPage.getContent().length;
    const cursor = this.currentRenderCursor;
    const progress = cursor / length;
    const progressText = (progress * 100).toFixed(2) + '%';
    const contents = this.readPage.readIndex.getContentsByCursor(cursor);
    const title = contents?.title ?? this.readPage.getMeta().title;
    if (this.titleElement.textContent !== title) {
      this.titleElement.textContent = title;
    }
    if (this.progressElement.textContent !== progressText) {
      this.progressElement.textContent = progressText;
    }
    this.updatePageActiveParagraphs();
  }
  updatePageActiveParagraphs() {
    const [screenWidth, screenHeight] = onResize.currentSize();
    const top = Math.max(0, this.textRenderArea.top - this.readBodyElement.getBoundingClientRect().top - screenHeight / 2);
    const startPosition = this.getScrollPosition(top - 2, false);
    const bottom = screenHeight * 1.5 - this.readBodyElement.getBoundingClientRect().top - this.textRenderArea.bottom;
    const endPosition = this.getScrollPosition(bottom, true);
    if (startPosition && endPosition) {
      const firstParagraph = startPosition.paragraph.prev ?? startPosition.paragraph;
      const lastParagraph = endPosition.paragraph.next ?? endPosition.paragraph;
      const oldActiveParagraphs = this.activeParagraphs;
      const newActiveParagraphs = this.activeParagraphs = [];
      for (let current = firstParagraph; current !== lastParagraph.next; current = current.next) {
        newActiveParagraphs.push(current);
      }
      oldActiveParagraphs.forEach(p => {
        if (!newActiveParagraphs.includes(p)) {
          p.element.setAttribute('aria-hidden', 'true');
        }
      });
      newActiveParagraphs.forEach(p => {
        if (!oldActiveParagraphs.includes(p)) {
          p.element.setAttribute('aria-hidden', 'false');
        }
      });
    } else {
      this.activeParagraphs.forEach(p => { p.element.setAttribute('aria-hidden', 'true'); });
      this.activeParagraphs = [];
    }
  }
  updatePageRender() {
    const oldScrollTop = this.updatePageCurrent();
    const prevChange = this.updatePagePrev();
    // Skip build next trunk if prev got changed in this animation frame for better performance
    const nextChange = prevChange == null || !this.scrollActive ? this.updatePageNext() : null;
    if (prevChange != null || nextChange != null) {
      if (this.lastHighlightStart != null) this.resetHighlightChars();
    }
    const newScrollTop = oldScrollTop + (prevChange ?? 0);
    this.setScrollTop(newScrollTop);
    if (prevChange && this.autoScrollRunning) this.autoScrollUpdate({ scrollDelta: prevChange });
  }
  async updatePage(config) {
    this.updatePageRender();

    const currentRun = {};
    const updatePageMeta = () => {
      if (this.updatePageMetaScheduled !== currentRun) return;
      this.updatePageMetaScheduled = false;
      this.updatePageMeta();
      const cursor = this.currentRenderCursor;
      if ((this.readPage.getRawCursor() ?? 0) !== cursor) {
        this.readPage.setCursor(cursor, config);
      }
    };
    if (this.scrollActive) {
      if (this.updatePageMetaScheduled) return;
      this.updatePageMetaScheduled = currentRun;
      if (window.requestIdleCallback) {
        setTimeout(() => {
          window.requestIdleCallback(updatePageMeta, { timeout: this.updateMetaTimeout / 2 });
        }, this.updateMetaTimeout / 2);
      } else {
        setTimeout(updatePageMeta, this.updateMetaTimeout);
      }
    } else {
      this.updatePageMetaScheduled = currentRun;
      updatePageMeta();
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
      if (this.scrollActive || this.scrollToBusy) return null;
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
    if (this.currentRenderCursor === cursor) return;
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
    if (this.autoScrollBusy()) this.autoScrollUpdate({ reset: true });
    this.clearPage();
    this.clearHighlight();
    this.currentRenderCursor = null;
    this.updatePage(config);
    if (this.autoScrollBusy()) this.autoScrollUpdate({ reset: true });
  }
  onResize() {
    super.onResize();
    this.resetPage({ resetSpeech: false, resetRender: true });
  }
  step() {
    return super.step() * 2;
  }
  hide() {
    super.hide();
    if (this.justShowControlPage) {
      this.justShowControlPage = false;
      this.autoScrollStart();
    }
  }
  autoScrollStart() {
    if (this.readPage.isSpeaking()) return;
    if (this.autoScrollRunning) return;
    this.autoScrollPaging = false;
    const currentAutoScroll = this.autoScrollRunning = {};
    this.readPage.controlPage.disable();
    this.container.classList.add('read-page-auto-scroll');
    const rAF = callback => {
      if (currentAutoScroll === this.autoScrollRunning) {
        window.requestAnimationFrame(callback);
      }
    };
    new Promise((resolve, reject) => {
      const historyTime = [];
      (function checkFrameTick(count) {
        if (count === 0) resolve();
        rAF(() => {
          const now = performance.now();
          if (historyTime.includes(now)) reject();
          else {
            historyTime.push(now);
            checkFrameTick(count - 1);
          }
        });
      }(5));
    }).then(() => {
      if (currentAutoScroll !== this.autoScrollRunning) return;
      window.getSelection()?.empty();
      this.autoScrollUpdate();
      this.autoScrollTick();
    }).catch(() => {
      // Some browsers may reduce the precision of `performance.now` to avoid fingerprinting.
      // For example, Firefox provides `privacy.resistFingerprinting` in its `about:config`.
      // As the result, we may not update our scroll position correctly in such condition.
      // So we give up providing this functionality if any two frames have same timestamp.
      this.autoScrollStop();
    });
    document.addEventListener('visibilitychange', this.autoScrollOnVisibilityChange);
  }
  autoScrollStop({ paging } = {}) {
    if (this.autoScrollRunning == null) return;
    this.autoScrollRunning = null;
    window.cancelAnimationFrame(this.autoScrollHandle);
    this.autoScrollStartTime = null;
    this.autoScrollStartPosition = null;
    this.autoScrollSpeed = null;
    this.autoScrollHandle = null;
    this.autoScrollSpeedFactorOld = null;
    document.removeEventListener('visibilitychange', this.autoScrollOnVisibilityChange);
    if (!paging) {
      this.readPage.controlPage.enable();
      this.container.classList.remove('read-page-auto-scroll');
      this.autoScrollPaging = false;
    } else {
      this.autoScrollPaging = true;
    }
  }
  autoScrollDistance(now) {
    if (this.autoScrollPaused) return 0;
    const time = now ?? performance.now();
    const timePast = time - this.autoScrollStartTime;
    return timePast * this.autoScrollSpeed * this.autoScrollSpeedFactor / 1000;
  }
  autoScrollUpdate({ scrollDelta = 0, speedFactor = null, paused = null, reset = false, time = null } = {}) {
    const now = performance.now();
    if (this.autoScrollStartTime == null || reset) {
      this.autoScrollStartPosition = this.lastScrollTop + scrollDelta;
    } else {
      this.autoScrollStartPosition += this.autoScrollDistance(time ?? now) + scrollDelta;
    }
    this.autoScrollStartTime = now;
    if (this.autoScrollSpeedFactor == null || speedFactor != null) {
      this.autoScrollSpeedFactor = Math.max(Math.min(speedFactor ?? 1, this.readSpeedFactorMax), this.readSpeedFactorMin);
    }
    if (this.autoScrollSpeed == null || reset) {
      const width = this.readScrollElement.clientWidth - this.textRenderArea.left - this.textRenderArea.right;
      const fontSize = Number(this.configs.font_size);
      const lineHeight = Number(this.configs.line_height);
      this.autoScrollSpeed = fontSize ** 2 * lineHeight * this.readSpeedBase / width;
    }
    if (paused != null) {
      this.autoScrollPaused = paused;
    }
  }
  autoScrollTick(isNextTick) {
    if (this.readPage.isSpeaking()) this.autoScrollStop();
    const now = performance.now();
    if (isNextTick && now - this.autoScrollLastTick > 1000) {
      this.autoScrollUpdate({ now });
    }
    this.autoScrollHandle = window.requestAnimationFrame(() => {
      const distance = this.autoScrollDistance(now);
      this.readScrollElement.scrollTop = this.autoScrollStartPosition + distance;
      this.autoScrollTick(true);
    });
  }
  autoScrollPause() {
    this.autoScrollUpdate({ paused: true });
  }
  autoScrollResume() {
    this.autoScrollUpdate({ paused: false });
  }
  autoScrollOnVisibilityChange() {
    if (!this.autoScrollRunning) return;
    if (document.hidden) this.autoScrollPause();
    else this.autoScrollResume();
  }
  autoScrollBusy() {
    return this.autoScrollRunning || this.autoScrollPaging;
  }
}

