export default class Page {
  constructor(/** @type {HTMLElement} */element) {
    this.element = element;
    this.initialized = false;
    this.actived = false;
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
  async onFirstActive() { }
  async onActive() { }
  async onUpdate() { }
  async onDeactive() { }
  async active(param) {
    if (!this.initialized) {
      this.initialized = true;
      await this.onFirstActive();
    }
    if (this.actived) {
      await this.onUpdate(param);
    } else {
      await this.onActive(param);
      this.actived = true;
      this.show();
    }
  }
  async deactive() {
    this.hide();
    await this.onDeactive();
    this.actived = false;
  }
  isActived() {
    return this.actived;
  }
  matchUrl(url) { return false; }
  getUrl(param) { return '/'; }
}

