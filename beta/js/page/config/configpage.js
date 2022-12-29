/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import Page from '../page.js';
import speech from '../../text/speech.js';
import config from '../../data/config.js';
import { optionList } from '../../data/options.js';
import i18n from '../../i18n/i18n.js';
import theme from '../../theme/theme.js';
import template from '../../ui/util/template.js';
import dom from '../../ui/util/dom.js';
import { TouchGestureListener } from '../../ui/util/touch.js';
import ItemList from '../../ui/component/itemlist.js';
import ColorPicker from '../../ui/component/color.js';


const slideClose = function (container, callback) {
  const minDistance = 20, activeWidth = 20;
  const touchListener = new TouchGestureListener(container, {
    minDistanceX: minDistance,
    minDistanceY: minDistance,
  });
  let isLeftTouch = false, lastMove = null;
  touchListener.onStart(([x, y], { touch }) => {
    if (!touch) return;
    if (x > activeWidth) return;
    isLeftTouch = true;
    lastMove = null;
  });
  touchListener.onEnd(({ touch }) => {
    if (!touch) return;
    isLeftTouch = false;
    container.classList.remove('config-page-close-slide');
    if (lastMove > minDistance) callback();
  });
  touchListener.onMoveX((move, { touch }) => {
    if (!touch) return;
    if (!isLeftTouch) return;
    lastMove = move;
    const slide = move > minDistance ? move : 0;
    container.classList.add('config-page-close-slide');
    container.style.setProperty('--close-slide-x', slide + 'px');
  });
  return touchListener;
};

class ConfigOptionPage {
  /**
   * @param {HTMLElement} container
   * @param {ConfigPage} mainPage
   */
  constructor(container, mainPage) {
    this.container = container;
    this.page = mainPage;

    const headerRef = template.create('header');
    this.container.insertBefore(headerRef.get('root'), this.container.firstChild);
    const back = template.iconButton('back', i18n.getMessage('buttonBack'));

    headerRef.get('left').appendChild(back);

    this.titleElement = headerRef.get('mid');
    this.backButton = back;
    const index = ConfigOptionPage.index = ConfigOptionPage.index + 1 || 1;
    this.titleElement.id = 'config_option_' + index;

    this.mainContent = container.querySelector('.config-page-content');

    this.onConfigValueChange = this.onConfigValueChange.bind(this);
    this.hide = this.hide.bind(this);
  }
  show() {
    this.container.classList.add('config-option-page-show');
    this.container.setAttribute('aria-hidden', 'false');
    this.page.configPageMain.setAttribute('aria-hidden', 'true');
    dom.disableKeyboardFocus(this.page.configPageMain);
    this.mainContent.scrollTop = 0;
    this.mainContent.focus();
    this.isActive = true;
    this.lastFocus = document.activeElement;
    if (this.lastFocus.matches('button')) {
      const target = this.mainContent.querySelector('button, [tabindex="0"]');
      if (target) target.focus();
    }
    this.touchListener = slideClose(this.container, this.hide);
  }
  hide() {
    this.container.classList.remove('config-option-page-show');
    this.container.setAttribute('aria-hidden', 'true');
    this.page.configPageMain.setAttribute('aria-hidden', 'false');
    dom.enableKeyboardFocus(this.page.configPageMain);
    this.isActive = false;
    if (this.lastFocus) this.lastFocus.focus();
    if (this.touchListener) {
      this.touchListener.dispatch();
      this.touchListener = null;
    }
  }
  onFirstActivate() {
    this.hide();
    this.backButton.addEventListener('click', () => { this.hide(); });
  }
  onActivate() { }
  onInactivate() { }
  async setConfigOption(configOption) {
    this.cleanUp();
    this.configOption = configOption;
    this.titleElement.textContent = configOption.title;
    await this.renderOptions();
    const value = await this.getValue();
    if (this.configOption !== configOption) return;
    this.renderValue(value);
    config.addListener(configOption.name, this.onConfigValueChange);
  }
  cleanUp() {
    if (this.configOption) {
      config.removeListener(this.configOption.name, this.onConfigValueChange);
      this.configOption = null;
    }
  }
  async renderOptions() { }
  renderValue(value) { }
  onConfigValueChange(value) {
    this.renderValue(value);
  }
  async setValue(value) {
    await this.configOption.setConfig(value);
  }
  async getValue(value) {
    return await this.configOption.getConfig(value);
  }
}

class SelectConfigOptionPage extends ConfigOptionPage {
  constructor(container, mainPage) {
    super(container, mainPage);
    this.listElement = this.container.querySelector('.config-option-select-list');
    this.description = this.container.querySelector('.config-option-select-description');
  }
  async optionList() {
    return this.configOption.select.slice(0);
  }
  async clearOptions() {
    this.itemList.clearList();
  }
  async renderOptions() {
    super.renderOptions();
    const configOption = this.configOption;
    const list = await this.optionList();
    if (configOption !== this.configOption) return;
    const render = (container, item) => {
      if (container.firstChild) return;
      const text = container.appendChild(document.createElement('div'));
      text.classList.add('select-config-option-item');
      text.textContent = item.text;
      if (item.render) item.render(text);
    };
    const onItemClick = item => {
      this.setValue(item.value);
    };
    this.itemList = new ItemList(this.listElement, {
      list,
      onItemClick,
      render,
      selectable: true,
      onRemove: this.onItemRemove,
      mayRemove: this.itemMayRemove,
      emptyListRender: this.emptyListRender,
    });
    this.value = null;
    this.itemList.listElement.setAttribute('aria-labelledby', this.titleElement.id);
    if (this.description) {
      this.description.textContent = configOption.description;
    }
  }
  cleanUp() {
    super.cleanUp();
    if (this.itemList) {
      this.itemList.dispatch();
      this.itemList = null;
    }
    this.value = null;
  }
  async renderValue(value) {
    super.renderValue(value);
    const configOption = this.configOption;
    const list = await this.optionList();
    if (configOption !== this.configOption) return;
    if (this.value != null) {
      const oldIndex = list.findIndex(i => i.value === this.value);
      if (oldIndex !== -1) this.itemList.setSelectItem(oldIndex, false);
    }
    this.value = value;
    const newIndex = list.findIndex(i => i.value === value);
    if (newIndex !== -1) {
      this.itemList.setSelectItem(newIndex, true);
    }
  }
}

class ColorConfigOptionPage extends ConfigOptionPage {
  constructor(container, mainPage) {
    super(container, mainPage);
    this.colorPickerElement = this.container.querySelector('.config-option-color-picker');
    this.colorPickerElement.setAttribute('aria-labelledby', this.titleElement.id);
  }
  async renderOptions() {
    await super.renderOptions();
    this.colorPicker = new ColorPicker(this.colorPickerElement);
    this.colorPicker.onChange(value => {
      this.setValue(value);
    });
  }
  cleanUp() {
    super.cleanUp();
    if (this.colorPicker) {
      this.colorPicker.dispatch();
      this.colorPicker = null;
    }
  }
  renderValue(value) {
    this.colorPicker.setColor(value);
  }
  onConfigValueChange() { }
}

class FontConfigOptionPage extends SelectConfigOptionPage {
  constructor(container, mainPage) {
    super(container, mainPage);

    this.selectFontButton = container.querySelector('#select_font_file');

    this.selectFontSectionElement = container.querySelector('.font-select-section');

    this.onItemRemove = this.onItemRemove.bind(this);
    this.itemMayRemove = this.itemMayRemove.bind(this);
  }
  onFirstActivate() {
    super.onFirstActivate();

    const selectFontRender = container => {
      const selectFontText = container.appendChild(document.createElement('div'));
      selectFontText.classList = 'select-font-button-inner';
      selectFontText.textContent = i18n.getMessage('configTextFontFamilyUpload');
    };
    const selectFont = () => {
      this.selectFontButton.click();
    };
    this.selectFontSection = new ItemList(this.selectFontSectionElement, {
      list: [null], render: selectFontRender, onItemClick: selectFont,
    });

    this.selectFontButton.addEventListener('change', event => {
      const file = this.selectFontButton.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', async event => {
        const content = reader.result;
        const name = file.name.replace(/^(.*)\.[^.]*$/, '$1');
        if (await this.isValidFont(content)) {
          await this.addFont({ name, content });
        } else {
          alert(i18n.getMessage('readFontFail'));
        }
        this.selectFontButton.value = '';
      });
      reader.readAsDataURL(file);
    });
  }
  async fontList() {
    const fonts = await config.get('font_list');
    if (!Array.isArray(fonts)) return [];
    return fonts;
  }
  async optionList() {
    const fontList = await this.fontList();
    return fontList
      .map(({ name, id }) => ({ text: name, value: id }))
      .concat([{ text: i18n.getMessage('configTextFontFamilyDefault'), value: 0 }]);
  }
  async getValue() {
    return (await super.getValue()) || 0;
  }
  async isValidFont(font) {
    const style = document.head.appendChild(document.createElement('style'));
    style.textContent = `@font-face { font-family: "CustomFontTest"; src: url("${font}"); }`;
    try {
      await document.fonts.load('18px CustomFontTest');
      return true;
    } catch (e) {
      return false;
    } finally {
      style.remove();
    }
  }
  async addFont(font) {
    let fonts = await this.fontList();
    const index = Math.max(0, ...fonts.map(font => font.id)) + 1;
    font.id = index;
    fonts.push(font);
    await config.set('font_list', fonts);
    this.itemList.insertItem({ text: font.name, value: index }, fonts.length - 1);
    await this.setValue(index);
  }
  itemMayRemove(item, index) {
    return item.value > 0;
  }
  async onItemRemove(item, index) {
    const id = item.value;
    const fonts = await this.fontList();
    const selectedId = await this.getValue();
    if (fonts[index].id !== id) {
      await this.updateRender();
      return;
    }
    fonts.splice(index, 1);
    this.itemList.removeItem(index);
    await config.set('font_list', fonts);
    if (selectedId === id) {
      this.setValue(0);
    }
  }
  async updateRender() {
    if (!this.itemList) return;
    await this.clearOptions();
    await this.renderOptions();
    await this.renderValue();
  }
}

class VoiceConfigOptionPage extends SelectConfigOptionPage {
  constructor(container, mainPage) {
    super(container, mainPage);

    /** @type {SpeechSynthesisVoice[]} */
    this.voiceList = [];
    /** @type {SpeechSynthesisVoice} */
    this.preferVoice = null;

    this.emptyListRender = this.emptyListRender.bind(this);
  }
  onFirstActivate() {
    super.onFirstActivate();

    this.description = this.container.querySelector('.config-option-voice-description');

    const update = () => {
      const prefer = speech.getPreferVoice();
      const list = speech.getVoiceList();
      this.updateVoiceList(list, prefer);
    };
    this.updateVoiceList([], null);
    Promise.all([
      speech.getVoiceListAsync(),
      speech.getPreferVoiceAsync(),
    ]).then(([list, prefer]) => {
      this.updateVoiceList(list, prefer);
      speech.onVoiceListChange(update);
      speech.onPreferVoiceChange(update);
    });
    speech.onVoiceListChange(() => { update(); });
    speech.onPreferVoiceChange(prefer => { this.updatePrefer(prefer); });
  }
  async updateVoiceList(list, prefer) {
    this.voiceList = list;
    this.preferVoice = prefer;
    if (this.itemList) {
      this.itemList.setList(await this.optionList());
      await this.renderValue(await this.getValue());
    }
  }
  async updatePrefer(prefer) {
    this.preferVoice = prefer;
    if (this.itemList) {
      await this.renderValue(await this.getValue());
    }
  }
  async optionList() {
    return this.voiceList.map(voice => ({
      text: `${voice.lang} ${voice.name}`,
      value: voice.voiceURI,
    }));
  }
  async getValue() {
    if (this.preferVoice) {
      return this.preferVoice.voiceURI;
    }
    if (this.voiceList.length) {
      return this.voiceList[0].voiceURI;
    }
    return null;
  }
  async setConfigOption(configOption) {
    this.configOption = configOption;
    this.titleElement.textContent = configOption.title;
    await this.renderOptions();
    const value = await this.getValue();
    if (this.configOption !== configOption) return;
    this.renderValue(value);
  }
  async renderOptions() {
    await super.renderOptions();
    this.description.textContent = this.configOption.description;
  }
  cleanUp() {
    this.configOption = null;
    if (this.itemList) {
      this.itemList.dispatch();
      this.itemList = null;
    }
  }
  emptyListRender(container) {
    const text = container.appendChild(document.createElement('div'));
    text.textContent = i18n.getMessage('configSpeechVoiceEmpty');
  }
}

class TextConfigOptionPage extends ConfigOptionPage {
  constructor(container, mainPage) {
    super(container, mainPage);
    this.onInput = this.onInput.bind(this);
  }
  onFirstActivate() {
    super.onFirstActivate();
    this.inputTitle = this.container.querySelector('.config-option-text-title');
    this.input = this.container.querySelector('.config-option-text-input');
    this.description = this.container.querySelector('.config-option-text-description');
    this.input.addEventListener('input', this.onInput);
  }
  async renderOptions() {
    await super.renderOptions();
    const configOption = this.configOption;
    this.inputTitle.textContent = configOption.label;
    this.description.textContent = configOption.description;
    this.input.value = await this.getValue();
  }
  async renderValue(value) {
  }
  onInput() {
    if (!this.configOption) return;
    this.setValue(this.input.value);
  }
}

class WebpageConfigOptionPage extends ConfigOptionPage {
  constructor(container, mainPage) {
    super(container, mainPage);
    this.themeChange = this.themeChange.bind(this);
  }
  getUrl() {
    return new URL('#' + theme.getCurrent(), new URL(this.configOption.url, document.baseURI));
  }
  onFirstActivate() {
    this.iframe = this.container.querySelector('iframe');
    this.placeholder = document.createComment('');
    this.iframeContainer = this.iframe.parentNode;
    this.iframeContainer.replaceChild(this.placeholder, this.iframe);
    super.onFirstActivate();
  }
  show() {
    super.show();
    this.iframe.src = this.getUrl();
    const url = this.iframe.src;
    theme.addChangeListener(this.themeChange);
    this.iframe.hidden = true;
    if (this.placeholder.parentNode === this.iframeContainer) {
      this.iframeContainer.replaceChild(this.iframe, this.placeholder);
    }
    this.iframe.addEventListener('load', () => {
      if (this.iframe.src !== url) return;
      if (this.iframe.parentNode !== this.iframeContainer) return;
      this.iframe.title = this.iframe.contentDocument.title;
      this.iframe.hidden = false;
    }, { once: true });
  }
  hide() {
    super.hide();
    this.iframe.src = 'about:blank';
    this.iframe.title = null;
    theme.removeChangeListener(this.themeChange);
    if (this.iframe.parentNode === this.iframeContainer) {
      this.iframeContainer.replaceChild(this.placeholder, this.iframe);
    }
  }
  themeChange() {
    this.iframe.src = this.getUrl();
  }
}

class ExpertConfigOptionPage extends ConfigOptionPage {
  constructor(container, mainPage) {
    super(container, mainPage);
    this.onInput = this.onInput.bind(this);
  }
  onFirstActivate() {
    super.onFirstActivate();
    this.input = this.container.querySelector('.config-option-expert-input');
    this.description = this.container.querySelector('.config-option-expert-description');
    this.input.addEventListener('input', this.onInput);
  }
  async renderOptions() {
    await super.renderOptions();
    const configOption = this.configOption;
    this.description.textContent = configOption.description;
    this.input.value = await this.getValue();
  }
  async renderValue(value) {
  }
  onInput() {
    if (!this.configOption) return;
    this.setValue(this.input.value);
  }
}

export default class ConfigPage extends Page {
  constructor() {
    const configPage = document.getElementById('config_page');
    super(configPage);

    this.configPage = configPage;
    this.configPageMain = configPage.querySelector('.config-page-main');
    this.addHeader();
    this.configPageMainContent = this.configPageMain.querySelector('.config-page-content');

    this.selectConfigPageElement = document.getElementById('config_page_select');
    this.selectConfigPage = new SelectConfigOptionPage(this.selectConfigPageElement, this);

    this.colorConfigPageElement = document.getElementById('config_page_color');
    this.colorConfigPage = new ColorConfigOptionPage(this.colorConfigPageElement, this);

    this.fontConfigPageElement = document.getElementById('config_page_font');
    this.fontConfigPage = new FontConfigOptionPage(this.fontConfigPageElement, this);

    this.voiceConfigPageElement = document.getElementById('config_page_voice');
    this.voiceConfigPage = new VoiceConfigOptionPage(this.voiceConfigPageElement, this);

    this.textConfigPageElement = document.getElementById('config_page_text');
    this.textConfigPage = new TextConfigOptionPage(this.textConfigPageElement, this);

    this.webpageConfigPageElement = document.getElementById('config_page_webpage');
    this.webpageConfigPage = new WebpageConfigOptionPage(this.webpageConfigPageElement, this);

    this.expertConfigPageElement = document.getElementById('config_page_expert');
    this.expertConfigPage = new ExpertConfigOptionPage(this.expertConfigPageElement, this);

    this.subConfigPages = [
      this.selectConfigPage,
      this.colorConfigPage,
      this.fontConfigPage,
      this.voiceConfigPage,
      this.textConfigPage,
      this.webpageConfigPage,
      this.expertConfigPage,
    ];
    /** @type {ConfigOptionPage} */
    this.activeSubConfigPage = null;

    this.keyboardHandler = this.keyboardHandler.bind(this);
  }
  addHeader() {
    const container = this.configPageMain;
    const headerRef = template.create('header');
    container.insertBefore(headerRef.get('root'), container.firstChild);
    const back = template.iconButton('back', i18n.getMessage('buttonBack'));
    headerRef.get('left').appendChild(back);
    headerRef.get('mid').textContent = i18n.getMessage('configPageTitle');
    this.gotoList = this.gotoList.bind(this);
    back.addEventListener('click', () => { this.gotoList(); });
  }
  matchUrl(url) { return /^\/settings(\/.*)?$/.test(url); }
  getUrl(item) {
    return item ? `/settings/${item}` : '/settings';
  }
  async onFirstActivate() {

    const configList = this.configPageMainContent;
    /**
     * @param {HTMLElement} container
     * @param {ConfigOption} item
     * @param {number} index
     */
    const itemRender = (container, item) => {
      item.setup(container);
    };
    /** @param {ConfigOption} item */
    const onItemClick = async item => {
      /** @type {ConfigOptionPage} */
      let subPage = null;
      if (item.subPageType === 'select') subPage = this.selectConfigPage;
      if (item.subPageType === 'color') subPage = this.colorConfigPage;
      if (item.subPageType === 'font') subPage = this.fontConfigPage;
      if (item.subPageType === 'voice') subPage = this.voiceConfigPage;
      if (item.subPageType === 'text') subPage = this.textConfigPage;
      if (item.subPageType === 'webpage') subPage = this.webpageConfigPage;
      if (item.subPageType === 'expert') subPage = this.expertConfigPage;
      if (this.activeSubConfigPage) {
        this.activeSubConfigPage.cleanUp();
      }
      this.activeSubConfigPage = subPage;
      if (subPage) {
        await subPage.setConfigOption(item);
        subPage.show();
      }
      if (item.onClick) {
        item.onClick();
      }
    };
    optionList().forEach(group => {
      const sectionElement = configList.appendChild(document.createElement('div'));
      sectionElement.classList.add('config-section');
      if (group.id) sectionElement.id = group.id;
      const titleElement = sectionElement.appendChild(document.createElement('div'));
      titleElement.classList.add('config-title');
      titleElement.setAttribute('role', 'heading');
      titleElement.textContent = group.title;
      const groupElement = sectionElement.appendChild(document.createElement('div'));
      groupElement.classList.add('config-group');
      new ItemList(groupElement, {
        list: group.items,
        onItemClick,
        render: itemRender,
      });
      if (group.description) {
        const descriptionElement = sectionElement.appendChild(document.createElement('div'));
        descriptionElement.classList.add('config-description');
        descriptionElement.textContent = group.description;
      }
    });

    this.subConfigPages.forEach(page => { page.onFirstActivate(); });
  }
  async onActivate() {
    document.addEventListener('keydown', this.keyboardHandler);
    this.touchListener = slideClose(this.configPageMain, this.gotoList);
  }
  async onInactivate() {
    this.subConfigPages.forEach(page => { page.onInactivate(); });
    document.removeEventListener('keydown', this.keyboardHandler);
    if (this.touchListener) this.touchListener.dispatch();
  }
  isPreserve() { return false; }
  /** @param {KeyboardEvent} event */
  keyboardHandler(event) {
    if (event.code === 'Escape') {
      const activePage = this.subConfigPages.find(page => page.isActive);
      if (activePage) activePage.hide();
      else this.gotoList();
      event.preventDefault();
    }
  }
  gotoList() {
    this.router.go('list');
  }
}


