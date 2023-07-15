/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import ReadPage from './readpage.js';
import dom from '../../ui/util/dom.js';

export default class ReadSubPage {
  /**
   * @param {HTMLElement} container
   * @param {ReadPage} readPage
   */
  constructor(container, readPage) {
    this.container = container;
    this.readPage = readPage;

    this.isCurrent = false;
    this.hide();
  }
  show() {
    this.isCurrent = true;
    this.container.classList.add('read-sub-page-current');
    this.container.removeAttribute('aria-hidden');
    dom.enableKeyboardFocus(this.container);
    dom.disableKeyboardFocus(this.readPage.controlPage.container);
  }
  hide() {
    this.isCurrent = false;
    this.container.classList.remove('read-sub-page-current');
    this.container.setAttribute('aria-hidden', 'true');
    dom.disableKeyboardFocus(this.container);
    dom.enableKeyboardFocus(this.readPage.controlPage.container);
  }
  currentActive() {
    return this.isCurrent;
  }
  onFirstActivate() { }
  onActivate() {
    this.hide();
  }
  onInactivate() { }
  onResize() { }
  cursorChange(cursor, config) { }
}

