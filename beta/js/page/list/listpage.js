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
import Menu from '../../ui/component/menu.js';

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
    this.fileListSensor = document.querySelector('#file_list_sensor');
    this.fileListTop = document.querySelector('#file_list_top');
    this.fileDropArea = document.querySelector('#drop_area');
    this.searchContainer = this.fileListContainer.querySelector('.list-filter');
    this.searchInput = this.searchContainer.querySelector('.list-filter input');
    this.searchClearButton = template.iconButton('remove', i18n.getMessage('listFilterClear'));
    this.sortButton = this.fileListContainer.querySelector('.list-sort button');
    this.sortContent = this.fileListContainer.querySelector('.list-sort-content');
    this.importTip = document.querySelector('#import_tip');

    this.searchInput.placeholder = i18n.getMessage('listSearchPlaceholder');
    this.searchClearButton.classList.add('list-filter-clear');
    this.searchClearButton.disabled = true;
    this.searchContainer.appendChild(this.searchClearButton);
    this.sortKey = {
      dateread: i18n.getMessage('listSortByDateRead'),
      dateadd: i18n.getMessage('listSortByDateAdd'),
      title: i18n.getMessage('listSortByTitle'),
    };
    this.sortMenu = new Menu({
      groups: [['dateread', 'dateadd', 'title'].map(value => ({
        title: this.sortKey[value],
        value,
      })), [{
        title: i18n.getMessage('listSortCancel'),
      }]],
    });
    this.initialListener();
    this.options = { sortBy: 'dateread', search: '' };
  }
  async onActivate() {
    this.updateSort();
    this.langTag = await config.get('cjk_lang_tag', navigator.language || 'und');
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

    /** @param {DragEvent} event */
    const isValidFlieDragEvent = event => {
      const items = event.dataTransfer.items;
      if (items.length !== 1) return false;
      if (items[0].kind !== 'file') return false;
      if (![
        'text/plain',
        'application/gzip',
        'application/x-gzip',
      ].includes(items[0].type)) return false;
      return true;
    };
    this.fileListElement.addEventListener('dragover', event => {
      if (isValidFlieDragEvent(event)) {
        this.fileListElement.classList.add('file-drag-over');
      } else {
        this.fileListElement.classList.remove('file-drag-over');
      }
      event.preventDefault();
    });
    this.fileDropArea.addEventListener('dragleave', event => {
      this.fileListElement.classList.remove('file-drag-over');
      event.preventDefault();
    });
    this.fileListElement.addEventListener('drop', event => {
      this.fileListElement.classList.remove('file-drag-over');
      if (!isValidFlieDragEvent(event)) return;
      /** @type {DataTransferItem} */
      const item = event.dataTransfer.items[0];
      const file = item.getAsFile();
      this.importFile(file);
      event.preventDefault();
    });
    this.sortMenu.bind(this.sortButton, sortBy => {
      if (!sortBy) return;
      this.options.sortBy = sortBy;
      this.updateSort();
      this.updateList();
    });
  }
  /** @param {File} item */
  async importFile(item) {
    let result = null;
    try {
      this.importTip.style.display = 'block';
      const raw_content = await text.readFile(item);
      const content = await text.preprocess(raw_content);
      const raw_title = text.parseFilename(item.name);
      const title = await text.preprocess(raw_title);
      result = await file.add({ title, content });
    } catch (e) {
      alert(i18n.getMessage('listImportFail'));
    }
    this.importTip.style.display = 'none';
    this.clearSearch();
    this.updateList();
    this.scrollToList();
    return result;
  }
  scrollToList() {
    if (!this.active) return;
    const scrollable = this.fileListSensor.clientHeight;
    if (scrollable) {
      this.fileListContainer.scrollTop = this.fileListTop.clientHeight;
    } else requestAnimationFrame(() => {
      this.scrollToList();
    });
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
    this.sortContent.querySelector('span').textContent = this.sortKey[this.options.sortBy];
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
      title: (a, b) => a.title.localeCompare(b.title, this.langTag || navigator.language),
    }[sortBy];
    files.sort(cmp);
  }
}


