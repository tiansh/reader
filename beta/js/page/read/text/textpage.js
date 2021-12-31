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
    this.mouseEvents = this.mouseEvents.bind(this);
    this.onResize = this.onResize.bind(this);
  }
  async onActivate({ id }) {
    this.isCurrent = true;

    this.container = this.createContainer();
    await this.updateStyleConfig();
    this.readPage.container.prepend(this.container);

    // EXPERT_CONFIG Use 4th / 5th button for paging
    this.useMouseClickPaging = await config.expert('appearance.mouse_paging', 'boolean', false);

    document.addEventListener('keydown', this.keyboardEvents);
    document.addEventListener('wheel', this.wheelEvents);
    this.container.addEventListener('mousedown', this.mouseEvents);

    onResize.addListener(this.onResize);
  }
  createContainer() {
    return document.createElement('div');
  }
  async onInactivate() {
    this.isCurrent = false;

    document.removeEventListener('keydown', this.keyboardEvents);
    document.removeEventListener('wheel', this.wheelEvents);
    this.container.removeEventListener('mousedown', this.mouseEvents);

    this.removeContainer(this.container);
    this.container = null;
    this.stepCache = null;

    onResize.removeListener(this.onResize);
  }
  removeContainer(container) {
    container.remove();
  }
  initUpdatePage() {
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
  onResize() {
    this.stepCache = null;
  }
  forceUpdate() { }
  keyboardEvents(event) { }
  wheelEvents(event) { }
  mouseEvents(event) { }
  clearHighlight() { }
  highlightChars(start, length) { return false; }
  cursorChange(cursor, config) { }
  getRenderCursor() {
    // I know this could be weird. This acturlly assumed we only need to ignore spaces.
    // But I didn't find out any better approach. As render text page requires the table
    // of contexts ready, while render the table of contexts requires text page been
    // rendered, which is a circular. So, this would be the best I can do here.
    // Hopefully it works.
    return this.ignoreSpaces(this.readPage.getRawCursor());
  }
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
    const styles = {
      '--read-dark-text-color': configs.dark_text,
      '--read-dark-background-color': configs.dark_background,
      '--read-light-text-color': configs.light_text,
      '--read-light-background-color': configs.light_background,
      '--read-font-size': configs.font_size + 'px',
      '--read-line-height': configs.line_height,
      '--read-paragraph-margin': configs.paragraph_spacing * configs.line_height * configs.font_size + 'px',
      '--read-font-family': font ? 'CustomFont' : 'auto',
    };
    const style = Object.keys(styles).map(prop => `${prop}: ${styles[prop]};`).join('\n');
    this.customStyle.textContent = `:root {\n${style}\n}`;

    this.configs = configs;
    try {
      await document.fonts.load(`${configs.font_size}px CustomFont`);
    } catch (e) {
      // ignore
    }
  }
  ignoreSpaces(cursor) {
    if (this.ignoreSpacesMemorizeStart === cursor) {
      return this.ignoreSpacesMemorizeEnd;
    }
    this.ignoreSpacesMemorizeStart = cursor;
    const content = this.readPage.getContent(), length = content.length;
    let lineBreak = cursor - 1;
    for (; /\s/.test(content[cursor]); cursor++) {
      if (content[cursor] === '\n') lineBreak = cursor;
    }
    const result = cursor >= length ? length : lineBreak + 1;
    this.ignoreSpacesMemorizeEnd = result;
    return result;
  }
  ignoreSpacesBackward(cursor) {
    const content = this.readPage.getContent();
    while (/\s/.test(content[cursor - 1])) cursor--;
    return cursor;
  }
  step() {
    if (this.stepCache) return this.stepCache;
    const [width, height] = onResize.currentSize();
    const area = width * height;
    const textArea = (this.configs?.font_size || 18) ** 2;
    this.stepCache = Math.floor(area / textArea);
    return this.stepCache;
  }
}

