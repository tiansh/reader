/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

export default class Page {
  constructor(/** @type {HTMLElement} */element) {
    this.element = element;
    this.initialized = false;
    this.active = false;
    /** @type {import('router.js').default} */
    this.router = null;
    this.hide();
  }
  setRouter(router) {
    this.router = router;
  }
  show() {
    this.element.classList.add('active-page');
    this.element.removeAttribute('aria-hidden');
  }
  hide() {
    this.element.classList.remove('active-page');
    this.element.setAttribute('aria-hidden', 'true');
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

