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
  }
  async onActivate({ id }) {
    this.langTag = await config.get('cjk_lang_tag');

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

    onResize.addListener(this.onResize);
    document.addEventListener('keydown', this.keyboardEvents);

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
    this.textPage.onInactivate();
    this.textPage = null;
    this.speech.stop();
  }
  gotoList() {
    this.router.go('list');
  }
  onResize() {
    this.updateSideIndex();
  }
  keyboardEvents(event) {
    if (event.code === 'Escape') {
      const current = this.isSubpageActived();
      if (current) current.hide();
      else if (this.controlPage.hasFocus) this.controlPage.hide();
      else this.controlPage.focus();
    }
  }
  updateSideIndex() {
    const sideIndex = window.innerWidth >= 960;
    if (sideIndex === this.useSideIndex) return;
    this.useSideIndex = sideIndex;
    if (sideIndex) {
      this.container.classList.add('read-page-wide');
      this.container.classList.remove('read-page-thin');
    } else {
      this.container.classList.remove('read-page-wide');
      this.container.classList.add('read-page-thin');
    }

    if (this.indexPage.isCurrent) {
      if (this.useSideIndex) {
        window.requestAnimationFrame(() => {
          this.onResize();
        });
        this.controlPage.enable();
        this.textPage.show();
      } else {
        this.controlPage.disable();
        this.textPage.hide();
      }
    }
  }
  isIndexActive() {
    return this.indexPage.isCurrent;
  }
  isSideIndexActive() {
    return this.useSideIndex && this.indexPage.isCurrent;
  }
  slideIndexPage(action, offset) {
    this.indexPage.slideShow(action, offset);
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
  isSubpageActived() {
    return this.isIndexActive() || this.isControlActive() || this.isJumpActive();
  }
  getCursor() {
    return this.meta.cursor;
  }
  setCursor(cursor) {
    if (this.meta.cursor === cursor) return;
    this.meta.cursor = cursor;
    file.setMeta(this.meta);
    this.subPages.forEach(page => page.cursorChange(cursor));
    this.textPage.cursorChange(cursor);
    this.speech.cursorChange(cursor);
  }
  getContent() { return this.content; }
  getMeta() { return this.meta; }
  getIndex() { return this.index; }
  getLang() { return this.langTag; }
  isSpeaking() { return this.speech.speaking; }
}

