import Page from './page.js';
import config from './config.js';
import onResize from './onresize.js';
import TouchListener from './touch.js';

/**
 * @typedef {Object} SelectConfigOption
 * @property {'select'} type
 * @property {{ value: string, text: string }[]} select
 * @property {string} default
 */
/**
 * @typedef {Object} ColorConfigOption
 * @property {'color'} type
 * @property {string} default
 */
/**
 * @typedef {Object} FontFamilyConfigOption
 * @property {'font'} type
 * @property {string?} default
 */
/**
 * @typedef {SelectConfigOption|ColorConfigOption|FontFamilyConfigOption} ConfigOption
 * @property {string} name
 */

/** @type {ConfigOption[]} */
const configOptions = [{
  name: 'theme',
  type: 'select',
  select: [
    { value: 'auto', text: 'Auto' },
    { value: 'light', text: 'Light' },
    { value: 'dark', text: 'Dark' },
  ],
  default: 'auto',
}, {
  name: 'dark_text',
  type: 'color',
  default: '#ffffff',
}, {
  name: 'dark_background',
  type: 'color',
  default: '#000000',
}, {
  name: 'light_text',
  type: 'color',
  default: '#000000',
}, {
  name: 'light_background',
  type: 'color',
  default: '#ffffff',
}, {
  name: 'font_family',
  type: 'font',
  default: null,
}, {
  name: 'font_size',
  type: 'select',
  select: [
    { value: '10', text: '10' },
    { value: '11', text: '11' },
    { value: '12', text: '12' },
    { value: '14', text: '14' },
    { value: '16', text: '16' },
    { value: '18', text: '18' },
    { value: '20', text: '20' },
    { value: '22', text: '22' },
    { value: '24', text: '24' },
    { value: '26', text: '26' },
  ],
  default: '18',
}];

class FontConfigPage {
  /**
   * @param {HTMLElement} container
   * @param {ConfigPage} configPage
   */
  constructor(container, configPage) {
    this.container = container;
    this.fontPage = container.querySelector('.config-page-font');
    this.button = container.querySelector('#select_font_button');
    /** @type {HTMLInputElement} */
    this.input = container.querySelector('#select_font_file');
    /** @type {HTMLTemplateElement} */
    this.template = container.querySelector('#font_item_template');
    this.fontList = this.template.parentNode;
    this.defaultItem = this.template.nextElementSibling;
    this.backButton = container.querySelector('#config_font_back');

    this.page = configPage;
  }
  onFirstActive() {
    this.addListener();
  }
  async onActive() {
    await this.updateList();
  }
  onDeactive() {

  }
  addListener() {
    this.button.addEventListener('click', event => {
      this.input.click();
    });
    this.input.addEventListener('change', event => {
      const file = this.input.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', async event => {
        const content = reader.result;
        const name = file.name.replace(/^(.*)\.[^.]*$/, '$1');
        await this.addFont({ name, content });
        await this.updateList();
      });
      reader.readAsDataURL(file);
    });
    this.backButton.addEventListener('click', event => {
      this.page.hideFontConfig();
    });
    this.defaultItem.addEventListener('click', async event => {
      await config.set('font_family', 0);
      await this.updateList();
    });
  }
  async addFont(font) {
    let fonts = await config.get('font_list');
    if (!Array.isArray(fonts)) fonts = [];
    const index = Math.max(0, ...fonts.map(font => font.id)) + 1;
    font.id = index;
    fonts.push(font);
    await config.set('font_list', fonts);
  }
  async removeFont(id) {
    let fonts = await config.get('font_list');
    if (!Array.isArray(fonts)) fonts = [];
    const pos = fonts.findIndex(font => font.id === id);
    if (pos !== -1) fonts.splice(pos, 1);
    await config.set('font_list', fonts);
    const chosedFont = await config.get('font_family');
    if (chosedFont === id) {
      await config.set('font_family', 0);
    }
  }
  async updateActive() {
    const items = Array.from(this.fontList.querySelectorAll('[data-font-id]'));
    const chosedFont = await config.get('font_family') || 0;
    items.forEach(item => {
      if (Number(item.dataset.fontId) === chosedFont) {
        item.classList.add('config-item-checked');
      } else {
        item.classList.remove('config-item-checked');
      }
    });
  }
  async updateList() {
    const fonts = await config.get('font_list');
    if (!Array.isArray(fonts)) return;
    while (this.template.previousSibling) {
      this.fontList.removeChild(this.template.previousSibling);
    }
    fonts.forEach(font => {
      const item = this.template.content.cloneNode(true).firstChild;
      item.querySelector('.config-item-title').textContent = font.name;
      item.dataset.fontId = font.id;
      this.fontList.insertBefore(item, this.template);

      let showDelete = false;
      const slideDelete = (action, offset) => {
        if (action === 'move') {
          this.fontPage.classList.add('font-item-slide-remove');
          item.classList.add('font-item-slide-remove');
          const off = showDelete ? offset - 80 : offset;
          const move = Math.min(0, Math.max(-90, off / 2 - 40));
          item.style.left = move + 'px';
        } else {
          this.fontPage.classList.remove('font-item-slide-remove');
          item.classList.remove('font-item-slide-remove');
          window.requestAnimationFrame(() => {
            if (action === 'show') showDelete = true;
            if (action === 'hide') showDelete = false;
            item.style.left = (showDelete ? -80 : 0) + 'px';
          });
        }
      };
      const choseFont = async event => {
        await config.set('font_family', font.id);
        await this.updateList();
      };

      const listener = new TouchListener(item, { clickParts: 1 });
      listener.onMoveX(offset => { slideDelete('move', offset); });
      listener.onSlideLeft(() => { slideDelete('show'); });
      listener.onSlideRight(() => { slideDelete('hide'); });
      listener.onCancelX(() => { slideDelete('cancel'); });
      listener.onTouch(choseFont);
      const fontRemove = item.querySelector('.font-remove');
      fontRemove.addEventListener('click', async event => {
        await this.removeFont(font.id);
        await this.updateList();
      });

      const cancelShowRemove = event => {
        if (!showDelete) return;
        const target = event.target;
        if (fontRemove.contains(target)) return;
        slideDelete('hide');
        event.preventDefault();
      };
      this.fontPage.addEventListener('touchstart', cancelShowRemove);
      this.fontPage.addEventListener('mousedown', cancelShowRemove);
    });
    this.updateActive();
  }
}

export default class ConfigPage extends Page {
  constructor() {
    const configPage = document.querySelector('#config_page');
    super(configPage);

    this.configPage = configPage;
    this.onResize = this.onResize.bind(this);
    this.backButton = document.querySelector('#config_back');

    this.fontConfigPageElement = document.querySelector('.config-page-font');
    this.fontConfigPage = new FontConfigPage(this.fontConfigPageElement, this);

    configOptions.forEach(config => {
      this.normalizeConfig(config);
    });
  }
  matchUrl(url) { return /^\/settings(\/.*)?$/.test(url); }
  getUrl(item) {
    return item ? `/settings/${item}` : '/settings';
  }
  async onFirstActive() {
    /** @type {HTMLElement[]} */
    const dataConfigs = Array.from(this.configPage.querySelectorAll('[data-config]'));
    this.configItems = Object.fromEntries(dataConfigs.map(item => {
      const name = item.dataset.config;
      return [name, item];
    }));

    configOptions.forEach(config => {
      this.initialConfig(this.configItems[config.name], config);
      this.normalizeConfig(config);
    });

    this.backButton.addEventListener('click', () => {
      this.router.go('list');
    });

    this.fontConfigPage.onFirstActive();
  }
  async onActive() {
    configOptions.forEach(item => {
      this.updateConfig(this.configItems[item.name], item);
    });
    onResize.addListener(this.onResize);
    this.fontConfigPage.onActive();
    this.hideFontConfig();
  }
  async onDeactive() {
    onResize.removeListener(this.onResize);
    this.fontConfigPage.onDeactive();
  }
  /**
   * @param {HTMLElement} container
   * @param {ConfigOption} item
   */
  initialConfig(container, item) {
    if (item.type === 'select') {
      const select = container.appendChild(document.createElement('select'));
      item.select.forEach(opt => {
        const option = select.appendChild(document.createElement('option'));
        option.value = opt.value;
        option.textContent = opt.text;
      });
      const text = container.appendChild(document.createElement('span'));
      select.addEventListener('change', async event => {
        await config.set(item.name, select.value);
        this.updateConfig(container, item);
      });
    } else if (item.type === 'color') {
      const color = container.appendChild(document.createElement('input'));
      color.type = 'color';
      color.addEventListener('change', async event => {
        await config.set(item.name, color.value);
        this.updateConfig(container, item);
      });
    } else if (item.type === 'font') {
      const button = container.appendChild(document.createElement('button'));
      button.addEventListener('click', event => {
        this.showFontConfig();
      });
    }
  }
  /**
   * @param {ConfigOption} item
   */
  async normalizeConfig(item) {
    let value = null;
    try {
      value = await config.get(item.name);
    } catch (e) {
      // use default
    }
    let isValid = false;
    if (value != null) {
      if (item.type === 'select') {
        isValid = item.select.find(item => item.value === value) !== null;
      } else if (item.type === 'color') {
        isValid = /^#[a-f0-9]{6}$/i.test(value);
      } else if (item.type === 'font') {
        if (value === 0) isValid = true;
        if (value > 0) {
          const allFonts = await config.get('font_list');
          isValid = allFonts.find(font => font.id === value);
        }
      }
    }
    if (!isValid) {
      await config.set(item.name, item.default);
      if (this.initialized) {
        this.updateConfig(this.configItems[item.name], item);
      }
    }
  }
  /**
   * @param {HTMLElement} container
   * @param {ConfigOption} item
   */
  async updateConfig(container, item) {
    const value = await config.get(item.name);
    if (item.type === 'select') {
      const select = container.querySelector('select');
      select.value = value;
      const text = container.querySelector('span');
      text.textContent = item.select.find(i => i.value === value).text;
    } else if (item.type === 'color') {
      const color = container.querySelector('input');
      color.value = value;
    } else if (item.type === 'font') {
      // do nothing
    }
  }
  onResize() {
    const activeElement = document.activeElement;
    configOptions.forEach(config => {
      const container = this.configItems[config.name];
      if (container.contains(activeElement)) {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }
  showFontConfig() {
    this.fontConfigPageElement.style.display = 'block';
  }
  hideFontConfig() {
    this.fontConfigPageElement.style.display = 'none';
  }
}


