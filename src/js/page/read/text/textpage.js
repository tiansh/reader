/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import ReadPage from '../readpage.js';
import config from '../../../data/config.js';
import dom from '../../../ui/util/dom.js';
import onResize from '../../../ui/util/onresize.js';

export default class TextPage {
  /**
   * @param {ReadPage} readPage
   */
  constructor(readPage) {
    this.readPage = readPage;
    this.isCurrent = false;
    this.keyboardEvents = this.keyboardEvents.bind(this);
    this.wheelEvents = this.wheelEvents.bind(this);
    this.onResize = this.onResize.bind(this);
  }
  async onActivate({ id }) {
    this.isCurrent = true;

    // EXPERT_CONFIG Add some custom CSS (danger)
    this.userCustomCss = await config.expert('appearance.custom_css', 'string', '');
    await this.updateStyleConfig();

    this.container = this.createContainer();
    this.readPage.container.prepend(this.container);

    document.addEventListener('keydown', this.keyboardEvents);
    document.addEventListener('wheel', this.wheelEvents);

    onResize.addListener(this.onResize);
  }
  createContainer() {
    return document.createElement('div');
  }
  async onInactivate() {
    this.isCurrent = false;

    this.removeContainer(this.container);
    this.container = null;

    document.removeEventListener('keydown', this.keyboardEvents);
    document.removeEventListener('wheel', this.wheelEvents);

    onResize.removeListener(this.onResize);
  }
  removeContainer(container) {
    container.remove();
  }
  show() {
    const container = this.container;
    if (container) {
      container.classList.remove('read-text-hidden');
      container.removeAttribute('aria-hidden');
      dom.enableKeyboardFocus(container);
    }
  }
  hide() {
    const container = this.container;
    if (container) {
      container.classList.add('read-text-hidden');
      container.setAttribute('aria-hidden', 'true');
      dom.enableKeyboardFocus(container);
    }
  }
  isInPage(cursor) {
    return false;
  }
  onResize() { }
  forceUpdate() { }
  keyboardEvents(event) { }
  wheelEvents(event) { }
  clearHighlight() { }
  highlightChars(start, length) { return false; }
  cursorChange(cursor, config) { }
  async updateStyleConfig() {
    this.customFont = document.querySelector('#custom_font');
    this.customStyle = document.querySelector('#custom_style');

    /** @type {
     ('light_text' | 'light_background' | 'dark_text' | 'dark_background' |
      'font_size' | 'font_family' | 'font_list' |
      'line_height' | 'paragraph_spacing')[]
     * } */
    const keys = [
      'light_text', 'light_background', 'dark_text', 'dark_background',
      'font_size', 'font_family', 'font_list',
      'line_height', 'paragraph_spacing',
    ];
    /** @type {{ [key in typeof keys[0]]?: string }} */
    const configs = Object.fromEntries(await Promise.all(keys.map(async key => [key, await config.get(key)])));
    const font = configs.font_family && Array.isArray(configs.font_list) &&
      configs.font_list.find(font => font.id === configs.font_family).content || null;
    this.customFont.textContent = [
      font ? `@font-face { font-family: "CustomFont"; src: url("${font}"); }` : '',
    ].join('\n');
    this.customStyle.textContent = [
      `.dark-theme .read-text-page { color: ${configs.dark_text}; background: ${configs.dark_background}; }`,
      `.light-theme .read-text-page { color: ${configs.light_text}; background: ${configs.light_background}; }`,
      `.read-text-page { font-size: ${configs.font_size}px; line-height: ${configs.line_height}; }`,
      `.read-text-page p { margin: 0; }`,
      `.read-text-page p:not(:first-child) { margin-top: ${configs.paragraph_spacing * configs.line_height * configs.font_size}px; }`,
      font ? `.read-text-page { font-family: CustomFont; }` : '',
    ].join('\n');
    if (this.userCustomCss) {
      this.customStyle.textContent += '\n' + this.userCustomCss;
    }
    this.configs = configs;
  }
  ignoreSpaces(cursor) {
    const content = this.readPage.getContent(), length = content.length;
    let lineBreak = cursor - 1;
    for (; /\s/.test(content[cursor]); cursor++) {
      if (content[cursor] === '\n') lineBreak = cursor;
    }
    if (cursor >= length) return length;
    return lineBreak + 1;
  }
}

