import RangeInput from './range.js';
import { TouchMoveListener } from './touch.js';

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

    this.setHue = this.setHue.bind(this);
    this.setBlackWhite = this.setBlackWhite.bind(this);
    /** @type {((value: number) => any)[]} */
    this.onValueChange = [];

    this.container.classList.add('color-picker');
    this.result = this.container.appendChild(document.createElement('div'));
    this.result.classList.add('color-picker-result');

    this.palette = this.container.appendChild(document.createElement('div'));
    this.palette.classList.add('color-picker-palette');

    this.picker = this.palette.appendChild(document.createElement('div'));
    this.picker.classList.add('color-picker-picker');

    this.hueBar = this.container.appendChild(document.createElement('div'));
    this.hueBar.classList.add('color-picker-hue');
    this.hueRange = new RangeInput(this.hueBar, { min: 0, max: 360, step: 0.1 });

    this.candidateList = this.container.appendChild(document.createElement('ul'));
    this.candidateList.classList.add('color-picker-candidate-list');

    this.hueRange.onChange(hue => {
      this.setHue(hue);
      this.triggerCallback();
    });

    this.setColor(0, 0, 0);

    const mouseMove = (pageX, pageY) => {
      const { x: paletteX, y: paletteY, height, width } = this.palette.getClientRects().item(0);
      const clientX = pageX - paletteX;
      const clientY = pageY - paletteY;
      const black = Math.min(1, Math.max(0, clientY / height));
      const white = Math.min(1, Math.max(0, 1 - clientX / width));
      this.setBlackWhite(black, white);
      this.triggerCallback();
    };
    this.touchMoveListener = new TouchMoveListener(this.palette);
    this.touchMoveListener.onTouchMove(mouseMove);

    this.candidateList.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const li = target.closest('li');
      if (!li) return;
      this.setValue(li.dataset.color);
      this.triggerCallback();
    });
  }
  setColor(hue, black, white) {
    this.black = black;
    this.white = white;
    this.setHue(hue);
  }
  setHue(hue) {
    this.hue = Number(hue);
    if (!Number.isFinite(this.hue)) this.hue = 0;
    else this.hue = Math.min(360, Math.max(0, this.hue));
    this.hueRange.setValue(this.hue);

    const i = Math.floor(this.hue % 360 / 60);
    const f = (this.hue % 60) / 60;
    const [r, g, b] = {
      0: [1, f, 0],
      1: [1 - f, 1, 0],
      2: [0, 1, f],
      3: [0, 1 - f, 1],
      4: [f, 0, 1],
      5: [1, 0, 1 - f],
    }[i];
    this.hueColor = new Color(r, g, b);

    this.container.style.setProperty('--color-picker-hue-color', this.hueColor.toHex());

    this.setBlackWhite(this.black, this.white);
  }
  setBlackWhite(black, white) {
    this.black = black;
    this.white = white;
    this.value = new Color(...[...'rgb'].map(c => (this.hueColor[c] * (1 - white) + white) * (1 - black)));
    this.container.style.setProperty('--color-picker-black', black);
    this.container.style.setProperty('--color-picker-white', white);
    this.container.style.setProperty('--color-picker-color', this.value.toHex());
  }
  /** @param {(value: string) => any} callback */
  onChange(callback) {
    this.onValueChange.push(callback);
  }
  setValue(value) {
    const setColor = Color.fromHex(value);
    if (setColor.toHex() === this.value.toHex()) return;
    const { r, g, b } = setColor;
    const [min, mid, max] = [r, g, b].sort((x, y) => x - y);
    if (max === min) {
      this.setColor(0, 1 - max, 1);
    } else {
      const black = 1 - max;
      const white = min / max;
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
      this.setColor(hue, black, white);
    }
  }
  triggerCallback() {
    this.onValueChange.forEach(callback => {
      callback(this.value.toHex());
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
    this.touchMoveListener.dispatch();
    this.hueRange.dispatch();
    this.container.innerHTML = '';
  }
}

