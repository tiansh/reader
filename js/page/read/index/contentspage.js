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
import text from '../../../text/text.js';
import ItemList from '../../../ui/component/itemlist.js';
import i18n from '../../../i18n/i18n.js';
import template from '../../../ui/util/template.js';

class IndexContentsTemplatePage {
  constructor() {
    this.keyboardEvents = this.keyboardEvents.bind(this);
  }
  /**
   * @param {IndexContentsPage} contentsPage
   * @param {HTMLElement} container
   */
  onFirstActivate(contentsPage, container) {
    this.contentsPage = contentsPage;

    this.container = container.querySelector('#read_index_contents_config');
    this.historyOption = optionMap().get('contents_history');
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

    this.templateButton = template.iconButton('go', i18n.getMessage('readContentsTemplateSubmit'));
    this.templateForm.appendChild(this.templateButton);
    this.templateButton.classList.add('submit-button');
    this.templateButton.type = 'submit';

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
  /**
   * @param {string[]} history
   */
  renderTemplateHistoryList(history) {
    if (!history || !history.length) {
      this.templateTitle.hidden = true;
      if (this.templateList) {
        this.templateList.dispatch();
        this.templateList = null;
      }
      return;
    }
    const list = history.slice(0);
    const onItemClick = template => {
      this.addHistory(template);
      this.contentsPage.refreshContents(template);
      this.hide();
    };
    const onRemove = async (item, index) => {
      this.templateList.removeItem(index);
      await this.historyOption.setConfig(list);
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
    this.templateTitle.hidden = false;
    if (this.templateList) {
      this.templateList.dispatch();
    }
    this.templateList = new ItemList(this.templateListElement, {
      list,
      onItemClick,
      onRemove,
      render,
    });
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

    this.container.addEventListener('keydown', this.keyboardEvents);
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
    if (this.container.contains(document.activeElement)) {
      document.activeElement.blur();
    }

    this.container.removeEventListener('keydown', this.keyboardEvents);
  }
  async addHistory(template) {
    const history = await this.historyOption.getConfig();
    const result = history.filter(item => item !== template);
    result.unshift(template);
    result.splice(20);
    await this.historyOption.setConfig(result);
  }
  /** @param {KeyboardEvent} event */
  keyboardEvents(event) {
    if (event.code === 'Escape' && !event.target.closest('input')) {
      this.hide();
      event.stopPropagation();
    }
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

    this.renderReal = true;
    this.fakeListElement = this.container.querySelector('#contents_list_fake');
    this.fakeListElement.remove();
  }
  onActivate() {
    super.onActivate();
    this.fakeListUl = this.fakeListElement.appendChild(document.createElement('ul'));
    this.fakeListUl.className = 'item-list item-list-selectable';
  }
  onInactivate() {
    this.recoverRealList();
    super.onInactivate();
    this.templatePage.hide();
    this.fakeListElement.innerHTML = '';
  }
  onResize() {
    this.refreshList();
  }
  setCurrent() {
    super.setCurrent();
  }
  unsetCurrent() {
    super.unsetCurrent();
    if (this.templatePage) this.templatePage.hide();
  }
  updateListRender() {
    super.updateListRender();
    const shouldRenderReal = this.isCurrent && this.isShow;
    if (shouldRenderReal && !this.renderReal) {
      // Wait some timeout so make sure the animation of slide in is finished
      // Maybe we should wait for some transition event, but it could be too complex
      // and waiting a fixed time should be enough here
      setTimeout(() => {
        if (this.isCurrent && this.isShow && !this.renderReal) {
          this.recoverRealList();
        }
      }, 100);
    } else if (!shouldRenderReal && this.renderReal) {
      this.hideRealList();
    }
  }
  createPageButton() {
    return template.iconButton('refresh', i18n.getMessage('buttonContentsRefresh'));
  }
  refreshContents(input) {
    const readIndex = this.readPage.readIndex;
    const template = (input == null ? readIndex.getContentsTemplate() : input) || '';
    readIndex.setContents(template);
    this.refreshList();
    this.indexPage.bookmarkPage.refreshList();
    this.readPage.textPage.forceUpdate();
  }
  pageButtonAction() {
    this.templatePage.show();
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
    title.title = item.title;
    title.lang = this.readPage.langTag;
  }
  getListItems() {
    const index = this.readPage.index;
    return index.content?.items || [];
  }
  getCurrentIndex() {
    const [index] = super.getCurrentIndex();
    return [index, true];
  }
  updateCurrentHighlight(position) {
    if (!this.renderReal) {
      this.recoverRealList();
      super.updateCurrentHighlight(position);
      this.hideRealList();
    } else {
      super.updateCurrentHighlight(position);
    }
  }
  refreshList() {
    if (!this.renderReal) {
      this.recoverRealList();
      super.refreshList();
      this.hideRealList();
    } else {
      super.refreshList();
    }
  }
  recoverRealList() {
    if (this.renderReal) return;
    this.renderReal = true;
    this.fakeListElement.before(this.listElement);
    this.listElement.scrollTop = this.fakeListElement.scrollTop;
    this.fakeListElement.remove();
  }
  hideRealList() {
    if (!this.renderReal) return;
    if (!this.itemList) return;
    if (this.itemList.isListEmpty()) return;
    this.renderReal = false;
    this.listElement.after(this.fakeListElement);
    this.updateFakeList();
    const scrollTop = this.listElement.scrollTop;
    window.requestAnimationFrame(() => {
      this.fakeListElement.scrollTop = scrollTop;
    });
    this.listElement.remove();
  }
  updateFakeList() {
    this.fakeListUl.innerHTML = '';
    const container = this.listElement;
    const listItems = Array.from(container.querySelectorAll('li'));
    if (!listItems.length) return;
    const start = listItems.findIndex(item => item.offsetTop + item.clientHeight >= container.scrollTop);
    let end;
    for (end = start; end < listItems.length && listItems[end].offsetTop <= container.scrollTop + container.clientHeight; end++) {
      this.fakeListUl.appendChild(listItems[end].cloneNode(true));
    }
    this.fakeListUl.style.paddingTop = listItems[start].offsetTop + 'px';
    const lastItem = listItems[end - 1];
    this.fakeListUl.style.paddingBottom = container.scrollHeight - lastItem.offsetTop - lastItem.clientHeight + 'px';
  }
}
