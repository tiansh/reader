/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import config from './config.js';
import i18n from '../i18n/i18n.js';
import template from '../ui/util/template.js';
import app from './app.js';

class ConfigOption {
  /** @param {{ name: string, description: string?, title: string }} config */
  constructor(config) {
    this.title = config.title;
    this.description = config.description ?? '';
    if (config.name != null) {
      this.name = config.name;
      this.default = null;
      this.initialized = false;
    } else {
      this.name = null;
    }
    this.rendered = false;
    if (!ConfigOption.globalIndex) {
      ConfigOption.globalIndex = 0;
    }
    this.index = ConfigOption.globalIndex++;
  }
  /** @returns {string} */
  get type() { throw Error('Unimplementated'); }
  get subPageType() { return this.type; }
  setConfig(value) {
    if (this.name == null) return (void 0);
    return config.set(this.name, value);
  }
  getConfig(value) {
    if (this.name == null) return (void 0);
    return config.get(this.name, value);
  }
  /**
   * @param {HTMLElement} container
   */
  render(container) {
    const itemElement = container.appendChild(document.createElement('div'));
    itemElement.classList.add('config-item');
    const titleElement = itemElement.appendChild(document.createElement('div'));
    titleElement.classList.add('config-item-title');
    titleElement.textContent = this.title;
    this.container = itemElement;
    this.titleElement = titleElement;
    this.rendered = true;
    this.titleElement.id = 'config_item_' + this.index;
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
      if (this.rendered) this.renderValue(this.default);
    }
  }
  async setup(container) {
    if (this.initialized) return;
    this.initialized = true;
    this.render(container);
    if (this.name != null) {
      await this.normalizeConfig();
      await config.get(this.name).then(value => {
        this.renderValue(value);
        config.addListener(this.name, value => {
          this.renderValue(value);
        });
      });
    }
  }
  detailIcon() {
    const detailIcon = template.icon('detail');
    detailIcon.classList.add('config-item-detail');
    detailIcon.setAttribute('aria-label', i18n.getMessage('configWithDetail'));
    return detailIcon;
  }
}

class SelectConfigOption extends ConfigOption {
  /** @param {{ name: string, title: string, select: { value: string, text: string }[], default: string, description: string }} config */
  constructor(config) {
    super(config);
    this.select = config.select;
    this.default = config.default;
  }
  get type() { return 'select'; }
  isValidValue(value) {
    return this.select.find(item => item.value === value) != null;
  }
  render(container) {
    super.render(container);
    const itemElement = container.firstChild;
    this.resultElement = itemElement.appendChild(document.createElement('span'));
    this.resultElement.classList.add('config-item-value');
    itemElement.appendChild(this.detailIcon());
    this.resultElement.id = 'config_item_value_' + this.index;
    this.resultElement.setAttribute('aria-labelledby', this.titleElement.id);
    this.titleElement.setAttribute('aria-labelledby', this.resultElement.id);
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
  render(container) {
    super.render(container);
    const itemElement = container.firstChild;
    this.resultElement = itemElement.appendChild(document.createElement('span'));
    this.resultElement.classList.add('config-item-value', 'config-item-color-value');
    itemElement.appendChild(this.detailIcon());
    this.resultElement.id = 'config_item_value_' + this.index;
    this.resultElement.setAttribute('aria-labelledby', this.titleElement.id);
    this.titleElement.setAttribute('aria-labelledby', this.resultElement.id);
  }
  renderValue(value) {
    this.resultElement.style.backgroundColor = value;
    this.resultElement.setAttribute('aria-label', value);
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
  render(container) {
    super.render(container);
    const itemElement = container.firstChild;
    this.resultElement = itemElement.appendChild(document.createElement('span'));
    this.resultElement.classList.add('config-item-value');
    itemElement.appendChild(this.detailIcon());
    this.resultElement.id = 'config_item_value_' + this.index;
    this.resultElement.setAttribute('aria-labelledby', this.titleElement.id);
    this.titleElement.setAttribute('aria-labelledby', this.resultElement.id);
  }
  renderValue(value) {
    const id = value ? 'configTextFontFamilyCustom' : 'configTextFontFamilyDefault';
    const text = i18n.getMessage(id);
    this.resultElement.textContent = text;
  }
}

class VoiceConfigOption extends ConfigOption {
  /** @param {{ name: string, title: string, description: string }} config */
  constructor(config) {
    super(config);
    this.default = config.default;
  }
  get type() { return 'voice'; }
  render(container) {
    super.render(container);
    const itemElement = container.firstChild;
    itemElement.appendChild(this.detailIcon());
  }
}

class TextConfigOption extends ConfigOption {
  /** @param {{ name: string, title: string, default: string, description: string }} config */
  constructor(config) {
    super(config);
    this.default = config.default;
    this.label = config.label;
  }
  get type() { return 'text'; }
  isValidValue(value) { return typeof value === 'string'; }
  render(container) {
    super.render(container);
    const itemElement = container.firstChild;
    this.resultElement = itemElement.appendChild(document.createElement('span'));
    this.resultElement.classList.add('config-item-value');
    itemElement.appendChild(this.detailIcon());
    this.resultElement.id = 'config_item_value_' + this.index;
    this.resultElement.setAttribute('aria-labelledby', this.titleElement.id);
    this.titleElement.setAttribute('aria-labelledby', this.resultElement.id);
  }
  renderValue(value) {
    this.resultElement.textContent = value;
  }
}

class StubConfigOption extends ConfigOption {
  constructor(config) { super(config); }
  setConfig(value) { }
  getConfig(value) { }
  renderValue(value) { }
  isValidValue(value) { return true; }
  async normalizeConfig() { }
  async setup(container) {
    if (this.initialized) return;
    this.initialized = true;
    this.render(container);
  }
}

class WebpageConfigOption extends StubConfigOption {
  /** @param {{ url: string }} config */
  constructor(config) {
    super(config);
    this.url = config.url;
  }
  get type() { return 'webpage'; }
}

class ValueConfigOption extends ConfigOption {
  /** @param {{ name: string, title: string, default: any, validator?: (any) => boolean, normalize: (any) => any }} config */
  constructor(config) {
    super(config);
    this.isValidValue = config.validator ?? (() => true);
    this.normalizeConfig = config.normalize ?? (value => value);
  }
  get type() { return 'value'; }
  async setConfig(value) {
    const setValue = this.normalizeConfig(this.isValidValue(value) ? value : null);
    await config.set(this.name, setValue);
  }
  async getConfig(defaultValue) {
    const value = await config.get(this.name, defaultValue);
    return this.normalizeConfig(value);
  }
}

class ExpertConfigOption extends ConfigOption {
  /** @param {{ name: string, title: string, default: string, description: string }} config */
  constructor(config) {
    super(config);
    this.default = config.default;
    this.label = config.label;
  }
  get type() { return 'expert'; }
  isValidValue(value) { return typeof value === 'string'; }
  render(container) {
    super.render(container);
    const itemElement = container.firstChild;
    itemElement.appendChild(this.detailIcon());
  }
  renderValue(value) {
  }
}

class ButtonConfigOption extends StubConfigOption {
  /** @param {{ onClick: () => void }} config */
  constructor(config) {
    super(config);
    this.onClick = config.onClick;
  }
  get type() { return 'button'; }
  get subPageType() { return null; }
  renderValue() {

  }
}

/**
 * @typedef {Object} ConfigGroup
 * @property {string} title
 * @property {ConfigOption[]} items
 */
/** @type {(ConfigGroup & { list?: boolean })[]} */
const options = (factory => {
  let cache = null;
  return () => {
    if (cache) return cache;
    cache = factory();
    factory = null;
    return cache;
  };
})(() => [{
  id: 'app_install',
  title: i18n.getMessage('configInstallGroupTitle'),
  items: [Object.assign(new ButtonConfigOption({
    title: i18n.getMessage('configInstallButton'),
    onClick() {
      if (app.supportInstall) app.showPrompt();
      else if (app.hasIosInstallTip) {
        // Simply show guides to tell user how to install
        // An `alert` should be enough here
        alert(i18n.getMessage('configInstallIosGuide'));
      }
    },
  }), {
    async setup(container) {
      Object.getPrototypeOf(this).setup.call(this, container);
      const button = container.closest('button');
      if (!app.supportInstall && !app.hasIosInstallTip) {
        button.disabled = true;
      }
      app.promptAvailable.then(() => {
        button.disabled = false;
      });
    },
  })],
  description: i18n.getMessage('configInstallGroupDescription'),
}, {
  title: i18n.getMessage('configModeGroupTitle'),
  items: [new SelectConfigOption({
    name: 'view_mode',
    title: i18n.getMessage('configMode'),
    select: [
      { value: 'flip', text: i18n.getMessage('configModeFlip') },
      { value: 'scroll', text: i18n.getMessage('configModeScroll') },
    ],
    default: 'flip',
  })],
}, {
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
    select: [10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 36, 40, 48, 56, 64].map(n => ({
      value: String(n),
      text: i18n.getMessage('configTextFontSizeNum', n),
    })),
    default: '18',
  }), new SelectConfigOption({
    name: 'line_height',
    title: i18n.getMessage('configTextLineHeight'),
    select: [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 2.0, 2.2, 2.5, 3.0, 4.0].map(n => ({
      value: String(n),
      text: i18n.getMessage('configTextLineHeightNum', n),
    })),
    default: '1.3',
  }), new SelectConfigOption({
    name: 'paragraph_spacing',
    title: i18n.getMessage('configTextParagraphSpacing'),
    select: [0, 0.2, 0.5, 0.8, 1, 1.2, 1.5, 2, 2.5, 3, 4].map(n => ({
      value: String(n),
      text: i18n.getMessage('configTextParagraphSpacingNum', n),
    })),
    default: '0.5',
  }), new TextConfigOption({
    name: 'cjk_lang_tag',
    title: i18n.getMessage('configTextLangTag'),
    label: i18n.getMessage('configTextLangTagTitle'),
    // We use user language setting on browser as fallback
    // As this could be the best guess for what text file user may import
    default: navigator.language || 'und',
    description: i18n.getMessage('configTextLangTagDescription'),
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
    description: i18n.getMessage('configSpeechVoicePrivacy'),
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
    select: [...Array(101)].map((_, i) => i / 10).slice(1).map(rate => ({
      value: String(rate),
      text: i18n.getMessage('configSpeechRateNum', rate),
    })),
    default: '1',
  })],
}, {
  title: i18n.getMessage('configHelpGroupTitle'),
  items: [new WebpageConfigOption({
    title: i18n.getMessage('configHelpTopic'),
    url: `./help/${i18n.getMessage('configHelpFilename')}`,
  }), new WebpageConfigOption({
    title: i18n.getMessage('configHelpCredits'),
    url: './help/credits.html',
  }), new WebpageConfigOption({
    title: i18n.getMessage('configHelpPrivacy'),
    url: './help/privacy.html',
  }), new WebpageConfigOption({
    title: i18n.getMessage('configHelpAbout'),
    url: './help/about.html',
  }), new SelectConfigOption({
    name: 'locale',
    title: i18n.getMessage('configLocale'),
    select: [
      { value: 'auto', text: i18n.getMessage('configLocaleAuto') },
      ...i18n.listLocales().map(locale => ({
        value: locale.id,
        text: locale.name,
        render: text => {
          text.lang = locale.id;
        },
      })),
    ],
    default: 'auto',
    description: i18n.getMessage('configLocaleDescription'),
  })],
}, {
  title: i18n.getMessage('configExpertGroupTitle'),
  items: [new ExpertConfigOption({
    name: config.EXPERT_CONFIG_NAME,
    default: '',
    title: i18n.getMessage('configExpert'),
    description: i18n.getMessage('configExpertDescription'),
  })],
}, {
  list: false,
  items: [new ValueConfigOption({
    name: 'contents_history',
    default: [],
    description: i18n.getMessage('readContentsTemplateDescription'),
    validator: value => Array.isArray(value) &&
      value.every(item => typeof item === 'string'),
    normalize: value => Array.isArray(value) ?
      value.filter((item, index) => (
        typeof item === 'string' && item &&
        value.indexOf(item) === index
      )).slice(0, 10) : [],
  })],
}]);

/** @type {ConfigGroup[]} */
export const optionList = () => options().filter(group => group.list !== false);
export const optionSet = () => new Set(options().flatMap(group => group.items));
export const optionMap = () => new Map(options().flatMap(group => group.items.map(item => [item.name, item])));

