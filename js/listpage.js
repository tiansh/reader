import Page from './page.js';
import ItemList from './itemlist.js';
import template from './template.js';
import text from './text.js';
import file from './file.js';
import i18n from './i18n.js';
import dom from './dom.js';

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

    this.fileListElement = document.querySelector('#file_list');

    this.sortButton = document.querySelector('.list-sort');
    this.sortContent = document.querySelector('.list-sort-content');
    this.sortMenu = document.querySelector('.list-sort-menu');
    this.importTip = document.querySelector('#import_tip');
    this.initialListener();
    this.options = { sortBy: 'dateread' };
  }
  async onActivate() {
    this.updateSort();
    await this.updateList();
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
        try {
          this.importTip.style.display = 'block';
          const item = files.item(0);
          const raw_content = await text.readFile(item);
          const content = await text.preprocess(raw_content);
          const raw_title = text.parseFilename(item.name);
          const title = await text.preprocess(raw_title);
          await file.add({ title, content });
          this.importTip.style.display = 'none';
        } catch (e) {
          alert(i18n.getMessage('listImportFail'));
        }
      }
      this.fileButton.value = null;
      this.updateList();
    });
    this.configButton.addEventListener('click', event => {
      this.router.go('config');
    });
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
  async updateList() {
    const token = this.lastToken = {};
    const files = await file.list();
    this.sortFiles(files);
    if (token !== this.lastToken) return;

    this.clearList();

    const render = (container, file) => {
      if (container.firstChild) return;
      const ref = template.create('fileListItem');
      ref.get('title').textContent = file.title;
      const date = file.lastAccessTime.toLocaleDateString();
      ref.get('date').textContent = date;
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
      text.textContent = i18n.getMessage('listEmptyTip');
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
  updateSort() {
    const menuItems = [...document.querySelectorAll('.list-sort-menu [data-option]')];
    const activeItem = menuItems.find(item => item.dataset.option === this.options.sortBy);
    this.sortContent.querySelector('span').textContent = activeItem.textContent;
  }
  sortFiles(/** @type {import('./storage.js').ReaderFileMeta[]} */files) {
    const sortBy = this.options.sortBy;
    const cmp = {
      dateread: (a, b) => b.lastAccessTime - a.lastAccessTime,
      dateadd: (a, b) => b.createTime - a.createTime,
      title: (a, b) => a.title.localeCompare(b.title, navigator.language),
    }[sortBy];
    files.sort(cmp);
  }
  showSortMenu() {
    this.sortMenu.style.display = 'block';
    this.element.setAttribute('aria-hidden', 'true');
    dom.disableKeyboardFocus(this.element);
  }
  hideSortMenu() {
    this.sortMenu.style.display = 'none';
    this.element.setAttribute('aria-hidden', 'false');
    dom.enableKeyboardFocus(this.element);
  }
}


