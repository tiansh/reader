/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import IndexSubPage from './indexsubpage.js';
import IndexPage from './indexpage.js';
import ReadPage from '../readpage.js';
import { optionMap } from '../../../data/options.js';
import file from '../../../data/file.js';
import text from '../../../text/text.js';
import ItemList from '../../../ui/component/itemlist.js';
import i18n from '../../../i18n/i18n.js';
import template from '../../../ui/util/template.js';

class IndexContentsTemplatePage {
  /**
   * @param {IndexContentsPage} contentsPage
   * @param {HTMLElement} container
   */
  onFirstActivate(contentsPage, container) {
    this.contentsPage = contentsPage;

    this.container = container.querySelector('#read_index_contents_config');
    this.historyOption = optionMap.get('contents_history');
    this.showTemplatePage = true;

    const headerRef = template.create('header');
    this.container.insertBefore(headerRef.get('root'), this.container.firstChild);
    const backButton = template.iconButton('back', i18n.getMessage('buttonBack'));
    this.backButton = headerRef.get('left').appendChild(backButton);
    this.backButton.addEventListener('click', event => {
      this.hide();
    });

    this.templateForm = this.container.querySelector('form');
    this.templateInput = this.container.querySelector('input');
    this.templateListElement = this.container.querySelector('.contents-history-list');
    this.templateTitle = this.container.querySelector('.contents-history-title');

    this.templateClear = template.iconButton('remove', i18n.getMessage('readContentsTemplateClear'));
    this.templateTitle.appendChild(this.templateClear);
    this.templateClear.classList.add('contents-history-clear');
    this.templateClear.addEventListener('click', event => {
      this.historyOption.setConfig([]);
      this.renderTemplateHistoryList(null);
    });

    this.templateForm.addEventListener('submit', event => {
      event.preventDefault();
      const template = this.templateInput.value;
      if (template) this.addHistory(template);
      this.contentsPage.refreshContents(template);
      this.hide();
    });

    this.hide();
  }
  renderTemplateHistoryList(list) {
    const onItemClick = template => {
      this.addHistory(template);
      this.contentsPage.refreshContents(template);
      this.hide();
    };
    const render = (container, item) => {
      if (container.firstChild) return;
      const element = container.appendChild(document.createElement('div'));
      element.classList.add('contents-history-item');
      element.textContent = item;
      element.lang = this.contentsPage.readPage.langTag;
      if (text.useRegExpForContent(item)) {
        element.classList.add('contents-history-item-regex');
      }
    };
    if (!list || !list.length) {
      this.templateTitle.hidden = true;
      if (this.templateList) {
        this.templateList.dispatch();
        this.templateList = null;
      }
    } else {
      this.templateTitle.hidden = false;
      if (this.templateList) {
        this.templateList.dispatch();
      }
      this.templateList = new ItemList(this.templateListElement, {
        list,
        onItemClick,
        render,
      });
    }
  }
  show() {
    if (!this.container) return;
    this.showTemplatePage = true;

    this.contentsPage.headerElement.hidden = true;
    this.contentsPage.listElement.hidden = true;
    this.contentsPage.indexPage.tabGroup.hidden = true;
    this.container.hidden = false;

    this.renderTemplateHistoryList(null);
    this.historyOption.getConfig().then(config => {
      if (!this.showTemplatePage) return;
      this.renderTemplateHistoryList(config);
    });

    const content = this.contentsPage.readPage.index.content;
    if (content) {
      this.templateInput.value = content.template;
    } else {
      this.templateInput.value = '';
    }
    this.templateInput.lang = this.contentsPage.readPage.langTag;
  }
  hide() {
    if (!this.showTemplatePage) return;
    this.showTemplatePage = false;
    if (this.templateList) {
      this.templateList.dispatch();
      this.templateList = null;
    }
    if (this.container) {
      this.contentsPage.headerElement.hidden = false;
      this.contentsPage.listElement.hidden = false;
      if (this.contentsPage.indexPage.tabGroup) {
        this.contentsPage.indexPage.tabGroup.hidden = false;
      }
      this.container.hidden = true;
    }
  }
  async addHistory(template) {
    const history = await this.historyOption.getConfig();
    const result = history.filter(item => item !== template);
    result.unshift(template);
    result.splice(5);
    await this.historyOption.setConfig(result);
  }
}

export default class IndexContentsPage extends IndexSubPage {
  /**
   * @param {HTMLElement} container
   * @param {HTMLElement} tabItem
   * @param {number} index
   * @param {IndexPage} indexPage
   * @param {ReadPage} readPage
   */
  constructor(container, tabItem, index, indexPage, readPage) {
    super(container, tabItem, index, indexPage, readPage);
    this.templatePage = new IndexContentsTemplatePage();
  }
  onFirstActivate() {
    super.onFirstActivate();
    this.templatePage.onFirstActivate(this, this.container);
  }
  hide() {
    super.hide();
    if (this.templatePage) this.templatePage.hide();
  }
  createPageButton() {
    return template.iconButton('refresh', i18n.getMessage('buttonContentsRefresh'));
  }
  refreshContents(input) {
    if (!this.readPage.index.content) {
      this.readPage.index.content = { template: '', items: [] };
    }
    const content = this.readPage.index.content;
    content.template = (input == null ? content.template : input) || '';
    if (content.template) {
      content.items = text.generateContent(this.readPage.content, content.template);
      content.items.unshift({ title: this.readPage.meta.title, cursor: 0 });
    } else {
      content.items = [];
    }
    file.setIndex(this.readPage.index);
    this.setList(content.items.slice(0));
    this.indexPage.bookmarkPage.updateBookmarkList();
    this.updateCurrentHighlight();
    this.readPage.textPage.forceUpdate();
  }
  pageButtonAction() {
    this.templatePage.show();
  }
  getContentsByCursor(cursor) {
    const index = this.readPage.index;
    const items = index.content && index.content.items || [];
    let last = items[0];
    items.every(item => {
      if (item.cursor > cursor) return false;
      last = item;
      return true;
    });
    return last || null;
  }
  emptyListRender(container) {
    const span = container.appendChild(document.createElement('span'));
    span.textContent = i18n.getMessage('readContentsEmpty');
  }
  listItemRender(container, item) {
    if (!container.firstChild) {
      const element = container.appendChild(document.createElement('div'));
      element.classList.add('index-contents-item');
    }
    const title = container.firstChild;
    title.textContent = item.title;
    title.lang = this.readPage.langTag;
  }
  getListItems() {
    const index = this.readPage.index;
    return index.content && index.content.items || [];
  }
  getCurrentHighlightIndex() {
    const cursor = this.readPage.meta.cursor;
    const items = this.readPage.index.content && this.readPage.index.content.items || [];
    const item = this.getContentsByCursor(cursor);
    const index = items.indexOf(item);
    if (index === -1) return null;
    return index;
  }
}
