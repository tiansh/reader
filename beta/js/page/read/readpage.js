/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import IndexPage from './index/indexpage.js';
import JumpPage from './jump/jumppage.js';
import ReadSpeech from './speech/readspeech.js';
import ControlPage from './control/controlpage.js';
import FlipTextPage from './text/fliptextpage.js';
import TextPage from './text/textpage.js';
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
    await this.speech.init();

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

    // EXPERT_CONFIG when index page show as side bar
    this.screenWidthSideIndex = await config.expert('read.screen_width_side_index', 'number', 960);

    this.meta = await file.getMeta(id);
    this.index = await file.getIndex(id);
    this.content = await file.content(id);
    if (!this.meta || !this.content) {
      this.gotoList();
      return;
    }
    await file.setMeta(this.meta);

    this.renderStyle = 'flip';
    if (this.renderStyle === 'flip') {
      /** @type {TextPage} */
      this.textPage = new FlipTextPage(this);
      this.container.classList.add('read-page-flip');
    }
    await this.textPage.onActivate({ id });
    this.speech.metaLoad(this.meta);

    onResize.addListener(this.onResize);
    document.addEventListener('keydown', this.keyboardEvents);
    document.title = i18n.getMessage('titleWithName', this.meta.title);

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
    this.useSideIndex = null;
    document.removeEventListener('keydown', this.keyboardEvents);
    this.subPages.forEach(page => { page.onInactivate(); });
    this.speech.stop();
    this.speech.metaUnload();
    this.textPage.onInactivate();
    this.textPage = null;
    document.title = i18n.getMessage('title');
  }
  gotoList() {
    this.router.go('list');
  }
  onResize() {
    this.updateSideIndex();
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
    const sideIndex = window.innerWidth >= this.screenWidthSideIndex;
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
    return this.indexPage && this.indexPage.isCurrent;
  }
  isSideIndexActive() {
    return this.useSideIndex && this.indexPage.isCurrent;
  }
  slideIndexPage(action, offset) {
    this.indexPage.slideShow(action, offset);
  }
  toggleIndexPage(page) {
    if (this.isIndexActive() && this.indexPage.isSubPageActive(page)) {
      this.indexPage.hide();
    } else {
      this.indexPage.show(page);
    }
  }
  isControlActive() {
    return this.controlPage.isCurrent;
  }
  showControlPage(focus) {
    if (focus) {
      this.controlPage.focus();
    } else {
      this.controlPage.show();
    }
  }
  toggleControlPage() {
    if (this.controlPage.isCurrent) this.controlPage.hide();
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
  toggleSpeech() {
    return this.speech.toggle();
  }
  getCursor() {
    return this.meta.cursor;
  }
  setCursor(cursor) {
    if (this.meta.cursor === cursor) return;
    this.updateCursor(cursor);
    this.speech.cursorChange(cursor);
  }
  updateCursor(cursor) {
    if (this.meta.cursor === cursor) return;
    this.meta.cursor = cursor;
    file.setMeta(this.meta);
    this.subPages.forEach(page => page.cursorChange(cursor));
    this.textPage.cursorChange(cursor);
  }
  getContent() { return this.content; }
  getMeta() { return this.meta; }
  getIndex() { return this.index; }
  getLang() { return this.langTag; }
  isSpeaking() { return this.speech.speaking; }
}

