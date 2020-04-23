export default class Page {
  constructor(/** @type {HTMLElement} */element) {
    this.element = element;
    this.initialized = false;
    this.active = false;
    /** @type {import('router.js').default} */
    this.router = null;
  }
  setRouter(router) {
    this.router = router;
  }
  show() {
    this.element.classList.add('active-page');
  }
  hide() {
    this.element.classList.remove('active-page');
  }
  async onFirstActivate() { }
  async onActivate() { }
  async onUpdate() { }
  async onInactivate() { }
  async activate(param) {
    if (!this.initialized) {
      this.initialized = true;
      await this.onFirstActivate();
    }
    if (this.active) {
      await this.onUpdate(param);
    } else {
      await this.onActivate(param);
      this.active = true;
      this.show();
    }
  }
  async inactivate() {
    this.hide();
    await this.onInactivate();
    this.active = false;
  }
  isActive() {
    return this.active;
  }
  matchUrl(url) { return false; }
  getUrl(param) { return '/'; }
  isPreserve() { return true; }
}

