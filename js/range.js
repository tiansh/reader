import { TouchMoveListener } from './touch.js';

/**
 * @typedef {Object} RangeConfig
 * @property {number} min
 * @property {number} max
 * @property {number} step
 */


export default class RangeInput {
  /**
   * @param {HTMLElement} container
   * @param {RangeConfig} config
   */
  constructor(container, config) {
    this.container = container;
    this.config = this.normalizeConfig(config);
    this.value = this.normalizeValue(config);

    /** @type {((value: number) => any)[]} */
    this.onValueChange = [];

    this.container.classList.add('range-container');
    this.thumb = container.appendChild(document.createElement('div'));
    this.thumb.classList.add('range-thumb');
    this.track = container.appendChild(document.createElement('div'));
    this.track.classList.add('range-track');

    const setRatio = ratio => {
      let pos = null;
      const config = this.config;
      if (ratio === 1) pos = config.max;
      if (ratio === 0) pos = config.min;
      else {
        pos = Math.min(config.max, Math.max(config.min,
          Math.round((config.max - config.min) * ratio / config.step) * config.step + config.min
        ));
      }
      if (this.value !== pos) {
        this.value = pos;
        this.onValueChange.forEach(callback => {
          callback(pos);
        });
        this.renderValue(pos);
      }
    };
    const mouseMove = pageX => {
      const clientX = pageX - this.track.getClientRects().item(0).x;
      const width = this.track.clientWidth;
      const ratio = clientX / width;
      setRatio(Math.min(Math.max(0, ratio), 1));
    };
    this.listener = new TouchMoveListener(this.container);
    this.listener.onTouchMove(mouseMove);
  }
  /**
   * @param {RangeConfig} config
   */
  setConfig(config) {
    this.config = this.normalizeConfig(config);
    this.value = this.normalizeValue(config);
  }
  getConfig() {
    return this.config;
  }
  /** @param {number} value */
  setValue(value) {
    const newValue = this.normalizeValue(Object.assign({}, this.config, { value: Number(value) }));
    if (newValue !== this.value) {
      this.value = newValue;
      this.renderValue(newValue);
    }
  }
  /** @param {(value: number) => any} callback */
  onChange(callback) {
    this.onValueChange.push(callback);
  }
  renderValue(value) {
    const config = this.config;
    const ratio = (value - config.min) / (config.max - config.min);
    this.container.style.setProperty('--range-ratio', ratio);
  }
  normalizeConfig(config) {
    let min = Number.isFinite(config.min) ? config.min : 0;
    let max = Number.isFinite(config.max) ? config.max : 1;
    if (min >= max) [min, max] = [0, 1];
    let step = Number.isFinite(config.step) ? config.step : 1;
    if (step <= 0) step = 1;
    return { min, max, step };
  }
  normalizeValue(config) {
    if (!Number.isFinite(config.value)) {
      return this.config.min;
    }
    if (config.value <= this.config.min) {
      return this.config.min;
    }
    if (config.value >= this.config.max) {
      return this.config.max;
    }
    return Math.round((config.value - this.config.min) / this.config.step) * this.config.step + this.config.min;
  }
  dispatch() {
    this.listener.dispatch();
    this.container.innerHTML = '';
  }
}
