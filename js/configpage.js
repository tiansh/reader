import Page from './page.js';
import config from './config.js';
import { TouchGestureListener } from './touch.js';
import speech from './speech.js';
import i18n from './i18n.js';
import ColorPicker from './color.js';
import ItemList from './itemlist.js';
import template from './template.js';

/**
 * @template {ConfigOption} OptionType
 */
class ConfigOptionPage {
  /**
   * @param {HTMLElement} container
   * @param {OptionType} mainPage
   */
  constructor(container, mainPage) {
    this.container = container;
    this.page = mainPage;

    const [header, headerRef] = template.create('page_header');
    this.container.insertBefore(header, this.container.firstChild);
    const [back] = template.create('back_button');
    headerRef.get('left').appendChild(back);

    this.titleElement = headerRef.get('mid');
    this.backButton = back;

    this.mainContent = container.querySelector('.config-page-content');

    this.onConfigValueChange = this.onConfigValueChange.bind(this);
  }
  show() {
    this.container.classList.add('config-option-page-show');
    this.mainContent.scrollTop = 0;
    this.mainContent.focus();
  }
  hide() {
    this.container.classList.remove('config-option-page-show');
  }
  onFirstActivate() {
    this.backButton.addEventListener('click', () => { this.hide(); });
  }
  onActivate() { }
  onInactivate() { }
  /**
   * @param {OptionType} configOption
   */
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
  renderOptions() { }
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
  }
  renderOptions() {
    super.renderOptions();
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
    this.colorPicker.setValue(value);
  }
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
        await this.addFont({ name, content });
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

class ConfigOption {
  /** @param {{ name: string, title: string }} config */
  constructor(config) {
    this.name = config.name;
    this.title = config.title;
    /** @type {string} */
    this.default = null;
    this.initialized = false;
  }
  /** @returns {string} */
  get type() { throw Error('Unimplementated'); }
  setConfig(value) { return config.set(this.name, value); }
  getConfig(value) { return config.get(this.name, value); }
  /**
   * @param {HTMLElement} container
   * @param {number} index
   */
  render(container, index) {
    const itemElement = container.appendChild(document.createElement('div'));
    itemElement.classList.add('config-item');
    const titleElement = itemElement.appendChild(document.createElement('div'));
    titleElement.classList.add('config-item-title');
    titleElement.textContent = this.title;
    this.container = itemElement;
  }
  renderValue(value) {}
  isValidValue(value) { return true; }
  async normalizeConfig() {
    let value = null;
    try {
      value = await config.get(this.name);
    } catch (e) {
      // use default
    }
    const isValid = await this.isValidValue(value);
    if (!isValid) {
      await config.set(this.name, this.default);
      this.renderValue(this.default);
    }
  }
  async setup(container, index) {
    if (this.initialized) return;
    this.initialized = true;
    this.render(container, index);
    await this.normalizeConfig();
    await config.get(this.name).then(value => {
      this.renderValue(value);
      config.addListener(this.name, value => {
        this.renderValue(value);
      });
    });
  }
  editConfig() {
    alert(this.name);
  }
}

class SelectConfigOption extends ConfigOption {
  /** @param {{ name: string, title: string, select: { value: string, text: string }[], default: string }} config */
  constructor(config) {
    super(config);
    this.select = config.select;
    this.default = config.default;
  }
  get type() { return 'select'; }
  isValidValue(value) {
    return this.select.find(item => item.value === value) != null;
  }
  render(container, index) {
    super.render(container, index);
    const itemElement = container.firstChild;
    this.resultElement = itemElement.appendChild(document.createElement('span'));
    this.resultElement.classList.add('config-item-value');
    const detailIcon = itemElement.appendChild(template.icon('detail'));
    detailIcon.classList.add('config-item-detail');
  }
  renderValue(value) {
    this.resultElement.textContent = this.select.find(i => i.value === value).text;
  }
}

/** @typedef {string} Color */
class ColorConfigOption extends ConfigOption {
  /** @param {{ name: string, title: string, default: Color }} config */
  constructor(config) {
    super(config);
    this.default = config.default;
  }
  get type() { return 'color'; }
  isValidValue(value) {
    return /^#[a-f0-9]{6}$/i.test(value);
  }
  render(container, index) {
    super.render(container, index);
    const itemElement = container.firstChild;
    this.resultElement = itemElement.appendChild(document.createElement('span'));
    this.resultElement.classList.add('config-item-value', 'config-item-color-value');
    const detailIcon = itemElement.appendChild(template.icon('detail'));
    detailIcon.classList.add('config-item-detail');
  }
  renderValue(value) {
    this.resultElement.style.backgroundColor = value;
  }
}

class FontConfigOption extends ConfigOption {
  /** @param {{ name: string, title: string, default: Color }} config */
  constructor(config) {
    super(config);
    this.default = config.default;
  }
  get type() { return 'font'; }
  async isValidValue(value) {
    if (value === 0) return true;
    const allFonts = await config.get('font_list');
    return allFonts.find(font => font.id === value);
  }
  render(container, index) {
    super.render(container, index);
    const itemElement = container.firstChild;
    this.resultElement = itemElement.appendChild(document.createElement('span'));
    this.resultElement.classList.add('config-item-value');
    const detailIcon = itemElement.appendChild(template.icon('detail'));
    detailIcon.classList.add('config-item-detail');
  }
  renderValue(value) {
    const id = value ? 'configTextFontFamilyCustom' : 'configTextFontFamilyDefault';
    const text = i18n.getMessage(id);
    this.resultElement.textContent = text;
  }
}

class VoiceConfigOption extends ConfigOption {
  /** @param {{ name: string, title: string, default: Color }} config */
  constructor(config) {
    super(config);
    this.default = config.default;
  }
  get type() { return 'voice'; }
  render(container, index) {
    super.render(container, index);
    const itemElement = container.firstChild;
    const detailIcon = itemElement.appendChild(template.icon('detail'));
    detailIcon.classList.add('config-item-detail');
  }
}

/**
 * @typedef {Object} ConfigGroup
 * @property {string} title
 * @property {ConfigOption[]} items
 */
/** @type {ConfigGroup[]} */
const configGroups = [{
  title: i18n.getMessage('configThemeGroupTitle'),
  items: [new SelectConfigOption({
    name: 'theme',
    title: i18n.getMessage('configTheme'),
    select: [
      { value: 'auto', text: i18n.getMessage('configThemeAuto') },
      { value: 'light', text: i18n.getMessage('configThemeLight') },
      { value: 'dark', text: i18n.getMessage('configThemeDark') },
    ],
    default: 'auto',
  })],
}, {
  title: i18n.getMessage('configDarkThemeGroupTitle'),
  items: [new ColorConfigOption({
    name: 'dark_text',
    title: i18n.getMessage('configDarkThemeColor'),
    default: '#ffffff',
  }), new ColorConfigOption({
    name: 'dark_background',
    title: i18n.getMessage('configDarkThemeBackground'),
    default: '#000000',
  })],
}, {
  title: i18n.getMessage('configLightThemeGroupTitle'),
  items: [new ColorConfigOption({
    name: 'light_text',
    title: i18n.getMessage('configLightThemeColor'),
    default: '#000000',
  }), new ColorConfigOption({
    name: 'light_background',
    title: i18n.getMessage('configLightThemeBackground'),
    default: '#ffffff',
  })],
}, {
  title: i18n.getMessage('configTextGroupTitle'),
  items: [new FontConfigOption({
    name: 'font_family',
    title: i18n.getMessage('configTextFontFamily'),
    default: null,
  }), new SelectConfigOption({
    name: 'font_size',
    title: i18n.getMessage('configTextFontSize'),
    select: [10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28].map(n => ({
      value: String(n),
      text: i18n.getMessage('configTextFontSizeNum', n),
    })),
    default: '18',
  })],
}, {
  title: i18n.getMessage('configPreprocessGroupTitle'),
  items: [new SelectConfigOption({
    name: 'max_empty_lines',
    title: i18n.getMessage('configPreprocessMultipleNewLine'),
    select: [
      { value: 'disable', text: i18n.getMessage('configPreprocessMultipleNewLineDisable') },
      ...[1, 2, 3, 4].map(n => ({
        value: String(n),
        text: i18n.getMessage('configPreprocessMultipleNewLineNum', n),
      })),
    ],
    default: 'disable',
  }), new SelectConfigOption({
    name: 'chinese_convert',
    title: i18n.getMessage('configPreprocessChineseConvert'),
    select: [
      { value: 'disable', text: i18n.getMessage('configPreprocessChineseConvertDisabled') },
      { value: 's2t', text: i18n.getMessage('configPreprocessChineseConvertS2T') },
      { value: 't2s', text: i18n.getMessage('configPreprocessChineseConvertT2S') },
    ],
    default: 'disable',
  })],
}, {
  title: i18n.getMessage('configSpeechGroupTitle'),
  items: [new VoiceConfigOption({
    name: 'speech_voice',
    title: i18n.getMessage('configSpeechVoice'),
    default: null,
  }), new SelectConfigOption({
    name: 'speech_pitch',
    title: i18n.getMessage('configSpeechPitch'),
    select: [...Array(21)].map((_, i) => i / 10).map(pitch => ({
      value: String(pitch),
      text: i18n.getMessage('configSpeechPitchNum', pitch),
    })),
    default: '1',
  }), new SelectConfigOption({
    name: 'speech_rate',
    title: i18n.getMessage('configSpeechRate'),
    select: [...Array(16)].map((_, i) => i / 10 + 0.5).map(rate => ({
      value: String(rate),
      text: i18n.getMessage('configSpeechRateNum', rate),
    })),
    default: '1',
  })],
}];


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

    // this.fontConfigPageElement = document.querySelector('.config-page-font');
    // this.fontConfigPage = new FontConfigPage(this.fontConfigPageElement, this);

    // this.voiceConfigPageElement = document.querySelector('.config-page-voice');
    // this.voiceConfigPage = new VoiceConfigPage(this.voiceConfigPageElement, this);

    // this.colorConfigPageElement = document.querySelector('.config-page-color');
    // this.colorConfigPage = new ColorConfigPage(this.colorConfigPageElement, this);

    this.subConfigPages = [
      this.selectConfigPage,
      this.colorConfigPage,
      this.fontConfigPage,
      this.voiceConfigPage,
    ];
    /** @type {ConfigOptionPage} */
    this.activeSubConfigPage = null;
  }
  addHeader() {
    const container = this.configPageMain;
    const [header, headerRef] = template.create('page_header');
    container.insertBefore(header, container.firstChild);
    const [back] = template.create('back_button');
    headerRef.get('left').appendChild(back);
    back.addEventListener('click', () => { this.router.go('list'); });
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
    const itemRender = (container, item, index) => {
      item.setup(container, index);
    };
    /** @param {ConfigOption} item */
    const onItemClick = async item => {
      /** @type {ConfigOptionPage} */
      let subPage = null;
      if (item.type === 'select') subPage = this.selectConfigPage;
      if (item.type === 'color') subPage = this.colorConfigPage;
      if (item.type === 'font') subPage = this.fontConfigPage;
      if (item.type === 'voice') subPage = this.voiceConfigPage;
      if (this.activeSubConfigPage) {
        this.activeSubConfigPage.cleanUp();
      }
      this.activeSubConfigPage = subPage;
      if (subPage) {
        await subPage.setConfigOption(item);
        subPage.show();
      }
    };
    configGroups.forEach(group => {
      const titleElement = configList.appendChild(document.createElement('div'));
      titleElement.classList.add('config-title');
      titleElement.textContent = group.title;
      const groupElement = configList.appendChild(document.createElement('div'));
      groupElement.classList.add('config-group');
      new ItemList(groupElement, { list: group.items, onItemClick, render: itemRender });
    });

    // this.backButton.addEventListener('click', () => {
    //   this.router.go('list');
    // });

    this.subConfigPages.forEach(page => { page.onFirstActivate(); });
  }
  async onActivate() {
  }
  async onInactivate() {
    this.subConfigPages.forEach(page => { page.onInactivate(); });
  }
}


