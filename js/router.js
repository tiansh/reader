import Page from './page.js';
import config from './config.js';

export default class Router {
  constructor(pages, fallback) {
    /** @type {{[id: string]: Page}} */
    this.pages = pages;
    this.fallback = fallback;
    [...Object.values(this.pages)].forEach(page => {
      page.setRouter(this);
    });
    window.addEventListener('hashchange', event => {
      this.update();
    });
    document.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest('a');
      if (!link) return;
      const hash = link.hash;
      const url = new URL(location.hash, link.href);
      if (url.href === location.href && hash) {
        this.hashTo(hash);
        event.preventDefault();
      }
    });
    this.initial();
  }
  go(id, param) {
    const url = this.pages[id].getUrl(param);
    this.hashTo('#!' + url);
  }
  async initial() {
    const path = await config.get('path') || '#!' + this.fallback;
    this.hashTo(path);
  }
  update() {
    const hash = location.hash;
    if (!hash.startsWith('#!')) { this.goFallback(); return; }
    const url = hash.slice(2);
    const pages = [...Object.values(this.pages)];
    const target = pages.find(page => page.matchUrl(url));
    if (!target) { this.goFallback(); return; }
    pages.forEach(page => {
      if (page.isActive() && page !== target) page.inactivate();
    });
    target.activate(target.matchUrl(url));
  }
  goFallback() {
    this.hashTo('#!' + this.fallback);
  }
  async hashTo(hash) {
    window.history.replaceState(null, null, hash);
    this.update();
    await config.set('path', hash);
  }
}
