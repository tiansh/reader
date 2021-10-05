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
    this.ignoreScrollSize = 2;
    this.pageMoveFactor = 0.8;
    this.scrollDoneTimeout = 500;
    this.scrollToTimeout = 1000;

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
  }
  createContainer() {
    const container = template.create('read_text_scroll');
    this.readBodyElement = container.get('body');
    this.readScrollElement = container.get('scroll');
    this.titleElement = container.get('title');
    this.progressElement = container.get('progress');

    let lastScrollEventRaf = false;
    this.readScrollElement.addEventListener('scroll', event => {
      if (lastScrollEventRaf) return;
      lastScrollEventRaf = true;
      this.scrollActive = true;
      window.requestAnimationFrame(() => {
        lastScrollEventRaf = false;
        this.onScroll();
      });
    }, { passive: true });

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
      this.onScrollToEnd();
    });

    return container.get('root');
  }
  onScroll() {
    const scrollTop = this.readScrollElement.scrollTop;
    const thisScrollEvent = this.lastScrollEvent = {};
    console.log('onscroll: ', this.readScrollElement.scrollTop);

    if (this.onScrollBusy) {
      this.onScrollDirty = true;
      return;
    }
    if (this.scrollToBusy) return;
    this.onScrollBusy = true;

    const textBufferHeight = this.getTextBufferHeight();

    // You cannot update scrollTop of the element on iOS during momentum scrolling (sometimes).
    // And I have no idea why following codes may solve this issue.
    // But it magically works.
    if (Math.abs(this.readScrollElement.scrollTop - this.lastScrollTop) > textBufferHeight) {
      console.log('Reset scroll: %o -> %o', this.readScrollElement.scrollTop, this.lastScrollTop);
      this.setScrollTop(this.lastScrollTop);
      this.readScrollElement.style.overflow = 'hidden';
      window.requestAnimationFrame(() => {
        this.readScrollElement.style.overflow = '';
        this.onScrollBusy = false;
        if (this.onScrollDirty) {
          this.onScroll();
        }
      });
    }

    this.updatePage({ resetSpeech: true });
    setTimeout(() => {
      if (thisScrollEvent !== this.lastScrollEvent) return;
      console.log('scroll done: ', this.readScrollElement.scrollTop);
      this.scrollActive = false;
      this.onScrollDone();
    }, this.scrollDoneTimeout);
  }
  onScrollDone() {
    this.updatePage({ resetSpeech: false });
  }
  onScrollToEnd() {
    const container = this.readScrollElement;
    const body = this.readBodyElement;
    const placeholder = container.querySelector('.read-body-scroll-placeholder');
    container.classList.remove('read-body-scroll-to');
    placeholder.remove();
    body.style.top = '';
    this.scrollToBusy = false;
    this.updatePageRender();
  }
  abortScrollTo() {
    const container = this.readScrollElement;
    const body = this.readBodyElement;
    const remained = Number.parseInt(window.getComputedStyle(body).top, 10);
    container.scrollTop -= remained;
    this.onScrollToEnd();
  }
  scrollTo(scrollTop) {
    const container = this.readScrollElement;
    const body = this.readBodyElement;
    if (this.scrollToBusy) this.abortScrollTo();
    const oldScrollTop = container.scrollTop;
    const scrollDistance = scrollTop - oldScrollTop;
    if (!scrollDistance) return;
    this.scrollToBusy = true;
    const placeholder = container.appendChild(document.createElement('div'));
    placeholder.classList.add('read-body-scroll-placeholder');
    placeholder.style.height = body.clientHeight + 'px';
    container.classList.add('read-body-scroll-to');
    container.scrollTop = scrollTop;
    body.style.top = scrollDistance + 'px';
    window.requestAnimationFrame(() => {
      body.style.top = '0';
    });
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
    this.scrollTo(scrollTop);
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
    // We cannot use document.elementFromPoint as certain position may belongs to padding of some paragraph
    const paragraphs = this.paragraphs;
    if (!paragraphs || !paragraphs.length) {
      return null;
    }
    const scrollTop = this.readScrollElement.scrollTop + this.textRenderArea.top - this.readBodyElement.offsetTop;
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
    const textBufferSize = this.textBufferSize;
    const textBufferHeight = onResize.currentSize()[1] * textBufferSize;
    return textBufferHeight;
  }
  setScrollTop(scrollTop) {
    console.log('Set scrollTop: ', scrollTop);
    if (Math.abs(this.readScrollElement.scrollTop - scrollTop) > this.ignoreScrollSize) {
      this.readScrollElement.scrollTop = scrollTop;
      this.lastScrollTop = scrollTop;
    } else {
      this.lastScrollTop = this.readScrollElement.scrollTop;
    }
  }
  updatePagePrev(current, prevContentsIndex) {
    const body = this.readBodyElement;
    const content = this.readPage.getContent();
    const readIndex = this.readPage.readIndex;
    const paragraphs = this.paragraphs;
    const textBufferHeight = this.getTextBufferHeight();

    // 3A. Let's render previous paragraphs
    const minimumHeight = body.clientHeight - current.element.offsetTop + textBufferHeight * (this.scrollActive ? 1 : 3);
    const targetHeight = body.clientHeight - current.element.offsetTop + textBufferHeight * 3;
    if (body.clientHeight < minimumHeight) do {
      const first = paragraphs[0];
      if (first.start === 0) break;
      const end = first.start - 1;
      const start = content.lastIndexOf('\n', end - 1) + 1;
      const heading = readIndex.getContentsByIndex(prevContentsIndex)?.cursor === start;
      const paragraph = this.renderParagraph(content.slice(start, end), { start, end, heading });
      body.insertBefore(paragraph.element, body.firstChild);
      paragraphs.unshift(paragraph);
      if (heading) prevContentsIndex--;
    } while (body.clientHeight < targetHeight);

    // 3A. Let's remove previous paragraph far away
    const currentTop = current.element.offsetTop;
    const maximumHeight = textBufferHeight * (this.scrollActive ? 8 : 5);
    if (currentTop > maximumHeight) {
      const allowOffset = currentTop - textBufferHeight * 4;
      const keepIndex = paragraphs.findIndex(paragraph => paragraph.element.offsetTop >= allowOffset) - 1;
      if (keepIndex > 0) {
        paragraphs.splice(0, keepIndex).forEach(paragraph => { paragraph.element.remove(); });
      }
    }
  }
  updatePageCurrent(cursor) {
    const body = this.readBodyElement;
    const content = this.readPage.getContent();
    const readIndex = this.readPage.readIndex;
    const paragraphs = this.paragraphs;

    const start = content.lastIndexOf('\n', cursor) + 1;
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
    const body = this.readBodyElement;
    const content = this.readPage.getContent();
    const readIndex = this.readPage.readIndex;
    const paragraphs = this.paragraphs;
    const textBufferHeight = this.getTextBufferHeight();

    const currentBottom = current.element.offsetTop + current.element.clientHeight;
    // 2A. Let's render following paragraphs
    const minimumHeight = currentBottom + textBufferHeight * (this.scrollActive ? 2 : 3);
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
    const maximumHeight = currentBottom + textBufferHeight * (this.scrollActive ? 8 : 12);
    if (body.scrollHeight > maximumHeight) {
      const allowOffset = currentBottom + textBufferHeight * 6;
      while (paragraphs.length > 2) {
        const ref = paragraphs[paragraphs.length - 2];
        const bottom = ref.element.offsetTop + ref.element.clientHeight;
        if (bottom <= allowOffset) break;
        paragraphs.pop().element.remove();
      }
    }
  }
  updatePageMeta({ title, progress }) {
    this.titleElement.textContent = title;
    this.progressElement.textContent = (progress * 100).toFixed(2) + '%';
  }
  resetPage(config) {
    this.clearPage();
    this.currentScrollPosition = null;
    if (this.onScrollBusy) {
      this.readScrollElement.style.overflow = '';
      this.onScrollBusy = null;
    }
    this.updatePage(config);
  }
  updatePageRender() {
    const body = this.readBodyElement;
    const readIndex = this.readPage.readIndex;
    const textBufferHeight = this.getTextBufferHeight();

    let position = this.getScrollPosition();
    let lastHeight = body.clientHeight;
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
      lastHeight = 0;
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
    const prevContentsIndex = contentsIndex !== -1 ? contentsIndex - currentIsContents : -1;
    const nextContentsIndex = contentsIndex !== -1 ? contentsIndex + currentIsContents : -1;

    this.updatePageNext(current, nextContentsIndex);
    const endingSizeChange = body.clientHeight - lastHeight;
    this.updatePagePrev(current, prevContentsIndex);
    const startingSizeChange = body.clientHeight - lastHeight - endingSizeChange;


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
    console.trace();
    console.log('Cursor Change: ', cursor, this.readPage.getContent().substr(cursor - 10, 20));
    const paragraph = this.paragraphs[this.getParagraphIndexByCursor(cursor)];
    if (!paragraph) {
      console.log('RESET');
      this.resetPage(config);
    } else {
      const textNode = paragraph.element.firstChild;
      const rect = this.getTextRect(textNode, cursor - paragraph.start);
      const top = rect.top - this.textRenderArea.top;
      const scrollTop = this.readScrollElement.scrollTop;
      console.log('CHANGE TO', rect.top, this.textRenderArea.top);
      if (Math.abs(top) > this.ignoreScrollSize) {
        this.pageTo(scrollTop + top, config);
      }
    }
  }
  onResize() {
    super.onResize();
    this.resetPage({ resetSpeech: false });
  }
}

