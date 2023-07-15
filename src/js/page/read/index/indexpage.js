/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import IndexContentsPage from './contentspage.js';
import IndexBookmarkPage from './bookmarkpage.js';
import IndexSearchPage from './searchpage.js';
import ReadSubPage from '../readsubpage.js';
import ReadPage from '../readpage.js';
import i18n from '../../../i18n/i18n.js';
import template from '../../../ui/util/template.js';
import dom from '../../../ui/util/dom.js';
import IndexSubPage from './indexsubpage.js';

export default class IndexPage extends ReadSubPage {
  /**
   * @param {HTMLElement} container
   * @param {ReadPage} readPage
   */
  constructor(container, readPage) {
    super(container, readPage);
  }
  onFirstActivate() {
    this.contentsPageElement = this.container.querySelector('#read_index_contents');
    this.contentsPageTabElement = this.container.querySelector('#read_index_contents_tab');
    this.contentsPage = new IndexContentsPage(this.contentsPageElement, this.contentsPageTabElement, 0, this, this.readPage);
    this.contentsPageTabElement.appendChild(template.icon('contents', i18n.getMessage('buttonContents')));

    this.bookmarkPageElement = this.container.querySelector('#read_index_bookmark');
    this.bookmarkPageTabElement = this.container.querySelector('#read_index_bookmark_tab');
    this.bookmarkPage = new IndexBookmarkPage(this.bookmarkPageElement, this.bookmarkPageTabElement, 1, this, this.readPage);
    this.bookmarkPageTabElement.appendChild(template.icon('bookmark', i18n.getMessage('buttonBookmark')));

    this.searchPageElement = this.container.querySelector('#read_index_search');
    this.searchPageTabElement = this.container.querySelector('#read_index_search_tab');
    this.searchPage = new IndexSearchPage(this.searchPageElement, this.searchPageTabElement, 2, this, this.readPage);
    this.searchPageTabElement.appendChild(template.icon('search', i18n.getMessage('buttonSearch')));

    this.subPages = [this.contentsPage, this.bookmarkPage, this.searchPage];
    this.subPageMap = { contents: this.contentsPage, bookmark: this.bookmarkPage, search: this.searchPage };

    this.currentSubPageIndex = 0;
    this.subPages.forEach(page => page.onFirstActivate());
    this.tabGroupContainer = this.container.querySelector('.index-tab-group');

    this.container.addEventListener('scroll', event => {
      this.container.scrollLeft = 0;
    });

    this.tabGroup = this.container.querySelector('.tab-group');
    this.tabGroup.addEventListener('keydown', event => {
      let targetPage = null;
      if (event.code === 'ArrowRight') {
        targetPage = this.subPages[this.currentSubPageIndex + 1];
      } else if (event.code === 'ArrowLeft') {
        targetPage = this.subPages[this.currentSubPageIndex - 1];
      }
      if (targetPage) this.setCurrentSubPage(targetPage);
    });

  }
  onActivate() {
    super.onActivate();
    this.subPages.forEach(page => page.onActivate());
    dom.disableKeyboardFocus(this.container);
    this.container.style.setProperty('--slide-offset', `0px`);
  }
  onInactivate() {
    super.onInactivate();
    this.subPages.forEach(page => page.onInactivate());
  }
  /**
   * @param {'show'|'hide'|'move'|'cancel'} action
   * @param {number} offset
   */
  slideShow(action, offset) {
    const isCurrent = this.isCurrent;
    if (action === 'move') {
      this.container.style.setProperty('--slide-offset', `${offset}px`);
      this.container.classList.add('read-index-slide');
    } else {
      if (action === 'show' && !isCurrent) {
        window.requestAnimationFrame(() => {
          this.container.style.setProperty('--slide-offset', `0px`);
          this.container.classList.remove('read-index-slide');
          this.show();
        });
      } else {
        this.container.style.setProperty('--slide-offset', `0px`);
        this.container.classList.remove('read-index-slide');
        if (action === 'hide') {
          this.hide();
        }
      }
    }
  }
  /**
   * @param {IndexSubPage} targetPage
   */
  setCurrentSubPage(targetPage) {
    this.subPages.forEach(page => {
      if (page !== targetPage) page.unsetCurrent();
    });
    targetPage.setCurrent();
    const pageIndex = targetPage.pageIndex;
    this.container.style.setProperty('--tab-index-current', pageIndex);
    this.tabGroup.style.setProperty('--active-index', pageIndex);
    this.currentSubPageIndex = pageIndex;
  }
  initUpdatePage() {
    if (this.subPages) this.subPages.forEach(page => { page.initUpdatePage(); });
  }
  show(/** @type {'contents'|'bookmark'|'search'|null} */page = null) {
    const actived = this.isCurrent;
    super.show();
    if (page) this.setCurrentSubPage(this.subPageMap[page]);
    else this.setCurrentSubPage(this.subPages[this.currentSubPageIndex]);
    dom.enableKeyboardFocus(this.container);
    if (this.isCurrent !== actived) {
      this.readPage.updateIndexRender();
    }
    if (this.subPages) this.subPages.forEach(page => { page.show(); });
  }
  hide() {
    const actived = this.isCurrent;
    super.hide();
    dom.disableKeyboardFocus(this.container);
    if (this.isCurrent !== actived) {
      this.readPage.updateIndexRender();
    }
    if (this.subPages) this.subPages.forEach(page => { page.hide(); });
  }
  isSubPageCurrent(/** @type {'contents'|'bookmark'|'search'} */page = null) {
    return this.subPageMap[page]?.isShow;
  }
  cursorChange(cursor, config) {
    this.subPages.forEach(page => {
      page.cursorChange(cursor, config);
    });
  }
  onResize() {
    super.onResize();
    this.subPages.forEach(page => { page.onResize(); });
  }
}
