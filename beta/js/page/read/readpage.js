/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import IndexPage from './index/indexpage.js';
import ReadIndex from './index/readindex.js';
import JumpPage from './jump/jumppage.js';
import ReadSpeech from './speech/readspeech.js';
import ControlPage from './control/controlpage.js';
import FlipTextPage from './text/fliptextpage.js';
import ScrollTextPage from './text/scrolltextpage.js';
import Page from '../page.js';
import file from '../../data/file.js';
import config from '../../data/config.js';
import onResize from '../../ui/util/onresize.js';
import i18n from '../../i18n/i18n.js';

export default class ReadPage extends Page {
  constructor() {
    super(document.querySelector('#read_page'));

    /** @type {boolean} */
    this.useSideIndex = null;
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
    this.container = document.querySelector('#read_page');

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

    const mayShare = this.canShareFile();
    this.shareFile = this.shareFile.bind(this);
    if (mayShare) {
      this.controlPage.registerMoreMenu(i18n.getMessage('readMenuShare'), this.shareFile);
    }
    this.downloadFile = this.downloadFile.bind(this);
    const maybeNeedDownload = !mayShare ||
      (navigator.userAgentData?.mobile !== true && !['iPhone', 'iPad'].includes(navigator.platform));
    if (maybeNeedDownload) {
      this.controlPage.registerMoreMenu(i18n.getMessage('readMenuDownload'), this.downloadFile);
    }
  }
  /**
   * @param {{ id: number }} config
   */
  async onActivate({ id }) {
    this.langTag = await config.get('cjk_lang_tag', 'und');
    this.renderStyle = await config.get('view_mode', 'flip');

    // EXPERT_CONFIG when index page show as side bar
    this.screenWidthSideIndex = await config.expert('appearance.screen_width_side_index', 'number', 960);

    this.articleId = id;
    const [meta, index, content] = await Promise.all([
      file.getMeta(id),
      file.getIndex(id),
      file.content(id),
    ]);
    this.meta = meta;
    this.content = content;
    this.index = index;
    if (!this.meta || !this.content) {
      this.gotoList();
      return;
    }
    await file.setMeta(this.meta);

    await this.speech.init();
    this.speech.metaLoad(this.meta);

    this.readIndex = new ReadIndex(this);
    if (this.renderStyle === 'flip') {
      this.textPage = new FlipTextPage(this);
      this.container.classList.add('read-page-flip');
    } else {
      this.textPage = new ScrollTextPage(this);
      this.container.classList.add('read-page-scroll');
    }
    await this.textPage.onActivate({ id });

    document.addEventListener('keydown', this.keyboardEvents);
    this.router.setTitle(this.meta.title, this.getLang());

    this.subPages.forEach(page => { page.onActivate(); });
    this.updateSideIndex();
  }
  async onUpdate({ id }) {
    this.onInactivate();
    this.onActivate({ id });
  }
  async onInactivate() {
    this.meta = null;
    this.index = null;
    this.content = null;
    this.pages = null;
    this.readIndex = null;
    this.useSideIndex = null;
    document.removeEventListener('keydown', this.keyboardEvents);
    this.subPages.forEach(page => { page.onInactivate(); });
    this.speech.stop();
    this.speech.metaUnload();
    this.textPage.onInactivate();
    this.textPage = null;
    this.container.classList.remove('read-page-scroll', 'read-page-flip');
    this.router.setTitle();
  }
  gotoList() {
    this.router.go('list');
  }
  show() {
    super.show();
    // Some text page render requires rendered dom to meansure its element size
    // So we have to put it after show().
    this.textPage.initUpdatePage();
    this.indexPage.initUpdatePage();
    onResize.addListener(this.onResize);
  }
  hide() {
    super.hide();
    onResize.removeListener(this.onResize);
  }
  onResize() {
    this.updateSideIndex();
    this.subPages.forEach(page => { page.onResize(); });
  }
  keyboardEvents(event) {
    if (event.code === 'Escape') {
      const current = this.activedSubpage();
      if (current) current.hide();
      else if (this.controlPage.hasFocus) this.controlPage.hide();
      else this.controlPage.focus();
    }
  }
  updateIndexRender(resized = this.useSideIndex) {
    const active = this.isIndexActive();
    if (active) {
      this.container.classList.add('read-show-index');
    } else {
      this.container.classList.remove('read-show-index');
    }
    if (active && !this.useSideIndex) {
      this.controlPage.disable();
      this.textPage.hide();
    } else {
      this.controlPage.enable();
      this.textPage.show();
    }
    if (resized) {
      window.requestAnimationFrame(() => {
        this.onResize();
      });
      this.textPage.onResize();
    }
  }
  updateSideIndex() {
    const [pageWidth, pageHeight] = onResize.currentSize();
    const sideIndex = pageWidth >= this.screenWidthSideIndex;
    if (sideIndex === this.useSideIndex) return;
    this.useSideIndex = sideIndex;
    if (sideIndex) {
      this.container.classList.add('read-page-wide');
      this.container.classList.remove('read-page-thin');
    } else {
      this.container.classList.remove('read-page-wide');
      this.container.classList.add('read-page-thin');
    }
    if (this.isIndexActive()) {
      this.updateIndexRender(true);
    }
  }
  isIndexActive() {
    return this.indexPage?.isCurrent;
  }
  isSideIndexActive() {
    return this.useSideIndex && this.indexPage.isCurrent;
  }
  slideIndexPage(action, offset) {
    this.indexPage.slideShow(action, offset);
  }
  toggleIndexPage(page) {
    if (this.isIndexActive() && this.indexPage.isSubPageCurrent(page)) {
      this.indexPage.hide();
    } else {
      this.indexPage.show(page);
    }
  }
  isControlActive() {
    return this.controlPage.isShow;
  }
  disableControlPage() {
    this.controlPage.hide();
    this.controlPage.disable();
  }
  enableControlPage() {
    this.controlPage.enable();
  }
  showControlPage(focus) {
    if (focus) {
      this.controlPage.focus();
    } else {
      this.controlPage.show();
    }
  }
  hideControlPage() {
    this.controlPage.hide();
  }
  toggleControlPage() {
    if (this.controlPage.isShow) this.controlPage.hide();
    else this.controlPage.show();
  }
  isJumpActive() {
    return this.jumpPage.isCurrent;
  }
  showJumpPage() {
    return this.jumpPage.show();
  }
  activedSubpage() {
    if (this.isIndexActive()) return this.indexPage;
    if (this.isControlActive()) return this.controlPage;
    if (this.isJumpActive()) return this.jumpPage;
    return null;
  }
  isTextPageOnTop() {
    if (this.isControlActive() || this.isJumpActive()) return false;
    if (this.isIndexActive()) return this.isSideIndexActive();
    return true;
  }
  toggleSpeech() {
    return this.speech.toggle();
  }
  /**
   * @returns The text position where user had read
   */
  getRawCursor() {
    return this.meta.cursor;
  }
  /**
   * @returns The text position where current page rendered
   */
  getRenderCursor() {
    return this.textPage.getRenderCursor();
  }
  /**
   * @typedef {Object} CursorChangeConfig
   * @property {boolean} resetSpeech
   * @property {boolean} resetRender
   */
  /**
   * @param {number} cursor
   * @param {CursorChangeConfig} config
   */
  setCursor(cursor, config) {
    if (this.meta.cursor === cursor) return;
    this.meta.cursor = cursor;
    file.setMeta(this.meta);
    this.textPage.cursorChange(cursor, config);
    this.subPages.forEach(page => page.cursorChange(cursor, config));
    this.speech.cursorChange(cursor, config);
  }
  getContent() { return this.content; }
  getMeta() { return this.meta; }
  getLang() { return this.langTag; }
  isSpeaking() { return this.speech.isWorking(); }
  getBookmarks() { return this.index.bookmarks; }
  getContents() { return this.index.content; }
  canShareFile() {
    try {
      if (!navigator.share) return false;
      if (!navigator.canShare) return false;
      const testFile = new File([''], 'file.txt', { type: 'text/plain' });
      return navigator.canShare({ files: [testFile] });
    } catch (_ignore) {
      return false;
    }
  }
  downloadContent() {
    const text = '\ufeff' + this.content.replace(/\r\n|\r|\n/g, '\r\n');
    return new TextEncoder().encode(text).buffer;
  }
  shareFile() {
    const file = new File([this.downloadContent()], this.meta.title + '.txt', { type: 'text/plain' });
    return navigator.share({ files: [file] });
  }
  downloadFile() {
    const blob = new Blob([this.downloadContent()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = this.meta.title + '.txt';
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => { URL.revokeObjectURL(url); }, 10e3);
  }
}

