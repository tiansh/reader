/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import Page from '../page.js';
import file from '../../data/file.js';
import text from '../../text/text.js';
import config from '../../data/config.js';
import i18n from '../../i18n/i18n.js';
import template from '../../ui/util/template.js';
import dom from '../../ui/util/dom.js';
import ItemList from '../../ui/component/itemlist.js';

export default class ListPage extends Page {
  constructor() {
    super(document.querySelector('#list_page'));
  }
  matchUrl(url) { return url === '/'; }
  getUrl(param) { return '/'; }
  async onFirstActivate() {
    const headerRef = template.create('header');
    this.element.insertBefore(headerRef.get('root'), this.element.firstChild);
    this.addButton = template.iconButton('add', i18n.getMessage('buttonAdd'));
    this.configButton = template.iconButton('settings', i18n.getMessage('buttonSettings'));
    headerRef.get('left').appendChild(this.addButton);
    headerRef.get('right').appendChild(this.configButton);

    /** @type {HTMLInputElement} */
    this.fileButton = document.querySelector('#file');

    this.fileListContainer = document.querySelector('#file_list_container');
    this.fileListElement = document.querySelector('#file_list');
    this.searchContainer = this.fileListContainer.querySelector('.list-filter');
    this.searchInput = this.searchContainer.querySelector('.list-filter input');
    this.searchClearButton = template.iconButton('remove', i18n.getMessage('listFilterClear'));
    this.sortButton = this.fileListContainer.querySelector('.list-sort');
    this.sortContent = this.fileListContainer.querySelector('.list-sort-content');
    this.sortMenu = document.querySelector('#list_sort_menu');
    this.importTip = document.querySelector('#import_tip');

    this.searchInput.placeholder = i18n.getMessage('listSearchPlaceholder');
    this.searchClearButton.classList.add('list-filter-clear');
    this.searchClearButton.disabled = true;
    this.searchContainer.appendChild(this.searchClearButton);
    this.initialListener();
    this.options = { sortBy: 'dateread', search: '' };
  }
  async onActivate() {
    this.updateSort();
    this.langTag = await config.get('cjk_lang_tag');
    await this.updateList();
  }
  show() {
    super.show();
    this.scrollToList();
  }
  async onInactivate() {
    this.clearList();
  }
  initialListener() {
    this.addButton.addEventListener('click', event => {
      this.fileButton.click();
    });
    this.fileButton.addEventListener('change', async event => {
      const files = this.fileButton.files;
      if (files.length === 1) {
        await this.importFile(files.item(0));
      }
      this.fileButton.value = null;
    });
    this.configButton.addEventListener('click', event => {
      this.router.go('config');
    });
    this.searchInput.addEventListener('focus', event => {
      this.fileListContainer.scrollTop = 0;
    });
    this.searchInput.addEventListener('input', event => {
      this.updateSearch();
    });
    this.searchClearButton.addEventListener('click', event => {
      this.clearSearch();
    });
    this.sortMenuKeyboardHandler = this.sortMenuKeyboardHandler.bind(this);
    this.sortButton.addEventListener('click', event => {
      this.showSortMenu();
    });
    this.sortMenu.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const item = target.closest('.screen-option-item');
      if (item) {
        const option = item.dataset.option;
        if (option) {
          this.options.sortBy = option;
          this.updateSort();
          this.updateList();
        }
      }
      this.hideSortMenu();
    });
  }
  async importFile(item) {
    try {
      this.importTip.style.display = 'block';
      const raw_content = await text.readFile(item);
      const content = await text.preprocess(raw_content);
      const raw_title = text.parseFilename(item.name);
      const title = await text.preprocess(raw_title);
      await file.add({ title, content });
    } catch (e) {
      alert(i18n.getMessage('listImportFail'));
    }
    this.importTip.style.display = 'none';
    this.clearSearch();
    this.updateList();
  }
  scrollToList() {
    this.fileListContainer.scrollTop = 105;
  }
  async updateList() {
    const token = this.lastToken = {};
    const files = await file.list();
    this.searchFiles(files);
    this.sortFiles(files);
    if (token !== this.lastToken) return;

    this.clearList();

    /**
     * @param {HTMLElement} container
     * @param {import('./storage.js').ReaderFileMeta} file
     */
    const render = (container, file) => {
      if (container.firstChild) return;
      const ref = template.create('fileListItem');
      const title = ref.get('title');
      title.textContent = file.title;
      title.lang = this.langTag;
      const dateLang = i18n.getMessage('locale');
      const date = file.lastAccessTime.toLocaleDateString(dateLang);
      ref.get('date').textContent = date;
      ref.get('date').lang = dateLang;
      ref.get('date').setAttribute('datetime', file.lastAccessTime.toISOString());
      const percent = file.cursor ?
        (file.cursor / file.length * 100).toFixed(2) + '%' :
        i18n.getMessage('listNotYetRead');
      ref.get('detail').textContent = percent;
      container.appendChild(ref.get('root'));
    };
    const onItemClick = file => {
      this.router.go('read', { id: file.id });
    };
    const onRemove = async (item, index) => {
      await file.remove(item.id);
      this.fileList.removeItem(index);
    };
    const emptyListRender = container => {
      const text = container.appendChild(document.createElement('div'));
      if (this.options.search) {
        text.textContent = i18n.getMessage('listEmptySearchTip');
      } else {
        text.textContent = i18n.getMessage('listEmptyTip');
      }
    };
    this.fileList = new ItemList(this.fileListElement, {
      list: files.slice(0),
      render,
      onItemClick,
      onRemove,
      emptyListRender,
    });
  }
  clearList() {
    if (this.fileList) {
      this.fileList.dispatch();
      this.fileList = null;
    }
  }
  updateSearch() {
    const search = this.searchInput.value.trim();
    this.options.search = search;
    this.searchClearButton.disabled = !search;
    return this.updateList();
  }
  clearSearch() {
    this.searchInput.value = '';
    return this.updateSearch();
  }
  updateSort() {
    const menuItems = [...document.querySelectorAll('.list-sort-menu [data-option]')];
    const activeItem = menuItems.find(item => item.dataset.option === this.options.sortBy);
    this.sortContent.querySelector('span').textContent = activeItem.textContent;
  }
  searchFiles(/** @type {import('../../data/storage.js').ReaderFileMeta[]} */files) {
    for (let i = 0; i < files.length;) {
      if (files[i].title.includes(this.options.search)) i++;
      else files.splice(i, 1);
    }
  }
  sortFiles(/** @type {import('../../data/storage.js').ReaderFileMeta[]} */files) {
    const sortBy = this.options.sortBy;
    const cmp = {
      dateread: (a, b) => b.lastAccessTime - a.lastAccessTime,
      dateadd: (a, b) => b.createTime - a.createTime,
      title: (a, b) => a.title.localeCompare(b.title, navigator.language),
    }[sortBy];
    files.sort(cmp);
  }
  /** @param {KeyboardEvent} event */
  sortMenuKeyboardHandler(event) {
    if (event.code === 'Escape') {
      this.hideSortMenu();
    }
  }
  showSortMenu() {
    this.sortMenu.style.display = 'block';
    this.element.setAttribute('aria-hidden', 'true');
    dom.disableKeyboardFocus(this.element);
    document.addEventListener('keydown', this.sortMenuKeyboardHandler);
    if (document.activeElement === this.sortButton) {
      this.sortMenu.querySelector('button').focus();
    }
    this.sortMenuActiveElementBefore = document.activeElement;
    if (document.activeElement.matches('button')) {
      const buttons = this.sortMenu.querySelectorAll('.screen-option-item');
      Array.from(buttons).pop().focus();
    }
  }
  hideSortMenu() {
    this.sortMenu.style.display = 'none';
    this.element.setAttribute('aria-hidden', 'false');
    dom.enableKeyboardFocus(this.element);
    document.removeEventListener('keydown', this.sortMenuKeyboardHandler);
    this.sortMenuActiveElementBefore.focus();
    this.sortMenuActiveElementBefore = null;
  }
}


