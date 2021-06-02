/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import RangeInput from './range.js';
import i18n from '../../i18n/i18n.js';

class Color {
  constructor(/** @type {number} */r, /** @type {number} */g, /** @type {number} */b) {
    this.r = r;
    this.g = g;
    this.b = b;
  }
  set(/** @type {number} */r, /** @type {number} */g, /** @type {number} */b) {
    this.r = r;
    this.g = g;
    this.b = b;
  }
  get() {
    return { r: this.r, g: this.g, b: this.b };
  }
  toHex() {
    return '#' + [...'rgb'].map(c => (
      Math.round(this[c] * 255).toString(16).padStart(2, 0)
    )).join('');
  }
  static fromHex(/** @type {string} */hex) {
    const hexVal = hex.replace(/^#/, '');
    const hexVal6 = hexVal.length === 3 ? hexVal.replace(/./g, '$&$&') : hexVal;
    const [r, g, b] = hexVal6.match(/../g).map(c => Number.parseInt(c, 16) / 255);
    return new Color(r, g, b);
  }
}

export default class ColorPicker {
  /**
   * @param {HTMLElement} container
   */
  constructor(container) {
    this.container = container;

    /** @type {((value: number) => any)[]} */
    this.onValueChange = [];

    this.container.classList.add('color-picker');
    this.result = this.container.appendChild(document.createElement('div'));
    this.result.classList.add('color-picker-result');

    this.hueBar = this.container.appendChild(document.createElement('div'));
    this.hueBar.classList.add('color-picker-hue');
    this.hueRange = new RangeInput(this.hueBar, { min: 0, max: 360, step: 0.1 });
    this.hueRange.onChange(hue => { this.setHSV({ hue }); });
    this.hueBar.setAttribute('aria-label', i18n.getMessage('colorHueRange'));

    this.saturationBar = this.container.appendChild(document.createElement('div'));
    this.saturationBar.classList.add('color-picker-saturation');
    this.saturationRange = new RangeInput(this.saturationBar, { min: 0, max: 1, step: 0.001 });
    this.saturationRange.onChange(saturation => { this.setHSV({ saturation }); });
    this.saturationBar.setAttribute('aria-label', i18n.getMessage('colorSaturationRange'));

    this.valueBar = this.container.appendChild(document.createElement('div'));
    this.valueBar.classList.add('color-picker-value');
    this.valueRange = new RangeInput(this.valueBar, { min: 0, max: 1, step: 0.001 });
    this.valueRange.onChange(value => { this.setHSV({ value }); });
    this.valueBar.setAttribute('aria-label', i18n.getMessage('colorValueRange'));

    this.candidateList = this.container.appendChild(document.createElement('ul'));
    this.candidateList.classList.add('color-picker-candidate-list');

    this.setHSV({ hue: 0, saturation: 0, value: 0 });

    this.candidateList.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const li = target.closest('li');
      if (!li) return;
      this.setColor(li.dataset.color);
    });
  }
  renderColor() {
    const region = Math.floor(this.hue % 360 / 60);
    const remind = (this.hue % 60) / 60;
    const [r, g, b] = {
      0: [1, remind, 0],
      1: [1 - remind, 1, 0],
      2: [0, 1, remind],
      3: [0, 1 - remind, 1],
      4: [remind, 0, 1],
      5: [1, 0, 1 - remind],
    }[region];
    this.hueColor = new Color(r, g, b);
    this.container.style.setProperty('--color-picker-hue-color', this.hueColor.toHex());

    const v = this.value;
    this.emptySaturationColor = new Color(v, v, v);
    this.fullSaturationColor = new Color(v * r, v * g, v * b);
    this.container.style.setProperty('--color-picker-empty-saturation', this.emptySaturationColor.toHex());
    this.container.style.setProperty('--color-picker-full-saturation', this.fullSaturationColor.toHex());

    const s = this.saturation;
    const [sr, sg, sb] = [r, g, b].map(c => 1 + c * s - s);
    this.emptyValueColor = new Color(0, 0, 0);
    this.fullValueColor = new Color(1 + r * s - s, 1 + g * s - s, 1 + b * s - s);
    this.container.style.setProperty('--color-picker-empty-value', this.emptyValueColor.toHex());
    this.container.style.setProperty('--color-picker-full-value', this.fullValueColor.toHex());

    const [tr, tg, tb] = [sr, sg, sb].map(c => c * v);
    this.color = new Color(tr, tg, tb);
    this.container.style.setProperty('--color-picker-color', this.color.toHex());
    this.result.setAttribute('aria-label', this.color.toHex());
  }
  setHSV({ hue, saturation, value }) {
    if (hue != null) this.setHue(hue);
    if (saturation != null) this.setSaturation(saturation);
    if (value != null) this.setValue(value);
    this.renderColor();
    this.triggerCallback();
  }
  normalizeValue(value, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    else return Math.min(max, Math.max(0, number));
  }
  setHue(hue) {
    this.hue = this.normalizeValue(hue, 360);
    this.hueRange.setValue(this.hue);
  }
  setSaturation(saturation) {
    this.saturation = this.normalizeValue(saturation, 1);
    this.saturationRange.setValue(this.saturation);
  }
  setValue(value) {
    this.value = this.normalizeValue(value, 1);
    this.valueRange.setValue(this.value);
  }
  /** @param {(value: string) => any} callback */
  onChange(callback) {
    this.onValueChange.push(callback);
  }
  setColor(color) {
    const setColor = Color.fromHex(color);
    if (setColor.toHex() === this.color.toHex()) return;
    const { r, g, b } = setColor;
    const [min, mid, max] = [r, g, b].sort((x, y) => x - y);
    if (max === min) {
      this.setHSV({ hue: 0, saturation: 0, value: max });
    } else {
      const i = [
        r >= g && g >= b,
        g >= r && r >= b,
        g >= b && b >= r,
        b >= g && g >= r,
        b >= r && r >= g,
        r >= b && b >= g,
      ].findIndex(x => x);
      const f = Math.abs((mid - min) / (max - min) - i % 2);
      const hue = 60 * (i + f);
      const saturation = 1 - min / max;
      const value = max;
      this.setHSV({ hue, saturation, value });
    }
  }
  triggerCallback() {
    if (this.hexColor === this.color.toHex()) return;
    this.hexColor = this.color.toHex();
    this.onValueChange.forEach(callback => {
      callback(this.hexColor);
    });
  }
  setCandidateList(colors) {
    this.candidateList.innerHTML = '';
    colors.forEach(color => {
      const item = this.candidateList.appendChild(document.createElement('li'));
      const button = item.appendChild(document.createElement('button'));
      button.type = 'button';
      button.title = color;
      item.dataset.color = color;
      button.style.background = color;
    });
  }
  dispatch() {
    this.hueRange.dispatch();
    this.saturationRange.dispatch();
    this.valueRange.dispatch();
    this.container.innerHTML = '';
  }
}

