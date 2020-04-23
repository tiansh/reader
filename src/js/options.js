import config from './config.js';
import i18n from './i18n.js';
import template from './template.js';


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
  renderValue(value) { }
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
    if (!Array.isArray(allFonts)) return false;
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
const options = [{
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
  }), new SelectConfigOption({
    name: 'line_height',
    title: i18n.getMessage('configTextLineHeight'),
    select: [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 2.0].map(n => ({
      value: String(n),
      text: i18n.getMessage('configTextLineHeightNum', n),
    })),
    default: '1.3',
  }), new SelectConfigOption({
    name: 'paragraph_spacing',
    title: i18n.getMessage('configTextParagraphSpacing'),
    select: [0, 0.2, 0.5, 1, 1.5, 2].map(n => ({
      value: String(n),
      text: i18n.getMessage('configTextParagraphSpacingNum', n),
    })),
    default: '0.2',
  })],
}, {
  title: i18n.getMessage('configPreprocessGroupTitle'),
  items: [new SelectConfigOption({
    name: 'max_empty_lines',
    title: i18n.getMessage('configPreprocessMultipleNewLine'),
    select: [
      { value: 'disable', text: i18n.getMessage('configPreprocessMultipleNewLineDisable') },
      ...[0, 1, 2, 3, 4].map(n => ({
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

export default options;

