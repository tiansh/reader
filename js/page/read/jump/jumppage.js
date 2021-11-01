/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import ReadSubPage from '../readsubpage.js';
import ReadPage from '../readpage.js';
import RangeInput from '../../../ui/component/range.js';

export default class JumpPage extends ReadSubPage {
  /**
   * @param {HTMLElement} container
   * @param {ReadPage} readPage
   */
  constructor(container, readPage) {
    super(container, readPage);
  }
  onFirstActivate() {
    this.rangeBar = this.container.querySelector('#jump_range');
    this.rangeInput = new RangeInput(this.rangeBar, { min: 0, max: 1, step: 1 });
    this.rangeInput.onChange(cursor => {
      this.readPage.setCursor(cursor, { resetSpeech: true, resetRender: true });
    });
    this.coverElement = this.container.querySelector('.read-jump-cover');
    this.coverElement.addEventListener('touchstart', event => {
      this.hide();
    }, { passive: true });
    this.coverElement.addEventListener('mousedown', event => {
      if (event.button === 0) this.hide();
    });
  }
  onActivate() {
    super.onActivate();
    this.rangeInput.setConfig({
      min: 0,
      max: this.readPage.content.length,
      step: 1,
    });
    this.updateInputValue();
  }
  show() {
    super.show();
    this.updateInputValue();
    this.rangeBar.focus();
    this.readPage.controlPage.disable();
  }
  hide() {
    super.hide();
    this.readPage.controlPage.enable();
  }
  cursorChange(cursor, config) {
    this.updateInputValue();
  }
  updateInputValue() {
    const cursor = this.readPage.getRawCursor();
    this.rangeInput.setValue(cursor);
  }
}

