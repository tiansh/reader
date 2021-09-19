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

    this.currentActiveIndex = 0;

    this.subPages.forEach(page => page.onFirstActivate());

    this.tabGroupContainer = this.container.querySelector('.index-tab-group');

    this.tabGroup = this.container.querySelector('.tab-group');
    this.tabGroup.addEventListener('keydown', event => {
      let targetPage = null;
      if (event.code === 'ArrowRight') {
        targetPage = this.subPages[this.currentActiveIndex + 1];
      } else if (event.code === 'ArrowLeft') {
        targetPage = this.subPages[this.currentActiveIndex - 1];
      }
      if (targetPage) this.showPage(targetPage);
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
      this.container.style.setProperty('--slide-offset', `0px`);
      this.container.classList.remove('read-index-slide');
      if (action === 'show' && !isCurrent) {
        window.requestAnimationFrame(() => {
          this.show();
        });
      } else if (action === 'hide') {
        this.hide();
      }
    }
  }
  showPage(targetPage) {
    this.subPages.forEach(page => {
      if (page !== targetPage) page.hide();
    });
    targetPage.show();
  }
  show(/** @type {'contents'|'bookmark'|'search'|null} */page = null) {
    const actived = this.isCurrent;
    super.show();
    if (page) this.showPage(this.subPageMap[page]);
    else this.showPage(this.subPages[this.currentActiveIndex]);
    dom.enableKeyboardFocus(this.container);
    if (this.isCurrent !== actived) {
      this.readPage.updateIndexRender();
    }
  }
  hide() {
    const actived = this.isCurrent;
    super.hide();
    dom.disableKeyboardFocus(this.container);
    if (this.isCurrent !== actived) {
      this.readPage.updateIndexRender();
    }
  }
  isSubPageActive(/** @type {'contents'|'bookmark'|'search'} */page = null) {
    const subPage = this.subPageMap[page];
    return subPage && subPage.isShow;
  }
  cursorChange(cursor, config) {
    this.subPages.forEach(page => {
      page.cursorChange(config);
    });
  }
}