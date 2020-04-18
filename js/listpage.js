import Page from './page.js';
import ItemList from './itemlist.js';
import template from './template.js';
import text from './text.js';
import file from './file.js';
import i18n from './i18n.js';

export default class ListPage extends Page {
  constructor() {
    super(document.querySelector('#list_page'));
  }
  matchUrl(url) { return url === '/'; }
  getUrl(param) { return '/'; }
  async onFirstActivate() {
    this.addButton = document.querySelector('#add');
    /** @type {HTMLInputElement} */
    this.fileButton = document.querySelector('#file');
    this.configButton = document.querySelector('#settings');

    this.fileListElement = document.querySelector('#file_list');

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
    this.sortContent.addEventListener('click', event => {
      this.sortMenu.style.display = 'block';
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
      this.sortMenu.style.display = 'none';
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
      const [element, ref] = template.create('file_list_item');
      ref.get('title').textContent = file.title;
      const date = file.lastAccessTime.toLocaleDateString();
      ref.get('date').textContent = date;
      const percent = file.cursor ?
        (file.cursor / file.length * 100).toFixed(2) + '%' :
        i18n.getMessage('listNotYetRead');
      ref.get('detail').textContent = percent;
      container.appendChild(element);
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
}


