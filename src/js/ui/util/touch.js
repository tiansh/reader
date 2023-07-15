/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import onResize from './onresize.js';

/** @typedef {[number, number]} Point */
/** @typedef {'x'|'y'} Direction */

export class TouchGestureListener {
  /**
   * @param {HTMLElement} targetElement
   */
  constructor(targetElement, { minDistanceX = 20, minDistanceY = 20, clickGridX = 1, clickGridY = 1, yRadian = Math.PI / 2 } = {}) {
    this.listeners = new Map();
    this.minDistanceX = minDistanceX;
    this.minDistanceY = minDistanceY;
    this.minDistance = Math.min(minDistanceX, minDistanceY);
    this.clickGridX = clickGridX;
    this.clickGridY = clickGridY;

    /** @type {Point} */
    let startPos = null, lastPos = null;
    /** @type {Direction} */
    let direction = null;
    let isTouch = null;
    const calculateDirection = ([dx, dy]) => {
      const distance = Math.hypot(dx, dy);
      if (distance > this.minDistance) {
        const angle = Math.atan2(dy, dx);
        return Math.abs(angle - (angle > 0 ? 1 : -1) * Math.PI / 2) < yRadian / 2 ? 'y' : 'x';
      }
      return null;
    };
    /** @type {Object<string, (position: Point) => any>} */
    const touchStartHandler = ({ position: [x, y], touch }) => {
      startPos = [x, y];
      lastPos = [x, y];
      direction = null;
      this.trigger('start', [x, y], { touch });
    };
    const touchCancelHandler = ({ touch }) => {
      this.trigger('end', { touch });
      if (direction) {
        const action = direction === 'x' ? 'cancelx' : 'cancely';
        this.trigger(action, { touch });
      }
      startPos = null;
      lastPos = null;
      direction = null;
    };
    const touchMoveHandler = ({ position: [x, y], touch }) => {
      if (!startPos) return;
      const [dx, dy] = [x - startPos[0], y - startPos[1]];
      lastPos = [x, y];
      if (direction === null) {
        direction = calculateDirection([dx, dy]);
      }
      if (direction) {
        const [width, height] = onResize.currentSize();
        const offset = direction === 'x' ? Math.min(dx, width) : Math.min(dy, height);
        const action = direction === 'x' ? 'movex' : 'movey';
        this.trigger(action, offset, { touch });
      }
    };
    const touchEndHandler = ({ touch }) => {
      if (!lastPos || !startPos) {
        touchCancelHandler();
        return;
      }
      this.trigger('end', { touch });
      const [dx, dy] = [lastPos[0] - startPos[0], lastPos[1] - startPos[1]];
      const offset = direction === 'x' ? dx : direction === 'y' ? dy : 0;
      if (!direction) {
        const rect = targetElement.getBoundingClientRect();
        const x = startPos[0] - rect.x, w = rect.width;
        const y = startPos[1] - rect.y, h = rect.height;
        const gridX = Math.max(Math.min(Math.floor(x * this.clickGridX / w), this.clickGridX - 1), 0);
        const gridY = Math.max(Math.min(Math.floor(y * this.clickGridY / h), this.clickGridY - 1), 0);
        this.trigger('touch', { touch, grid: { x: gridX, y: gridY } });
      } else {
        const minDistanceArrow = direction === 'x' ? this.minDistanceX : this.minDistanceY;
        if (Math.abs(offset) < minDistanceArrow) {
          const action = direction === 'x' ? 'cancelx' : 'cancely';
          this.trigger(action, { touch });
        } else {
          const action = direction === 'x' ? dx > 0 ? 'slideright' : 'slideleft' :
            dy > 0 ? 'slidedown' : 'slideup';
          this.trigger(action, { touch });
        }
      }
      startPos = null;
      lastPos = null;
      direction = null;
    };
    const moveListener = new TouchMoveListener(targetElement);
    moveListener.onTouchStart(touchStartHandler);
    moveListener.onTouchMove(touchMoveHandler);
    moveListener.onTouchEnd(touchEndHandler);
    moveListener.onTouchCancel(touchCancelHandler);

    this.dispatch = () => {
      moveListener.dispatch();
    };
  }
  trigger(action, ...meta) {
    if (!this.listeners.has(action)) return;
    this.listeners.get(action).forEach(listener => {
      listener(...meta);
    });
  }
  addListener(action, listener) {
    if (!this.listeners.has(action)) {
      this.listeners.set(action, []);
    }
    this.listeners.get(action).push(listener);
  }
  onStart(listener) { return this.addListener('start', listener); }
  onEnd(listener) { return this.addListener('end', listener); }
  onTouch(listener) { return this.addListener('touch', listener); }
  onMoveX(listener) { return this.addListener('movex', listener); }
  onMoveY(listener) { return this.addListener('movey', listener); }
  onCancelX(listener) { return this.addListener('cancelx', listener); }
  onCancelY(listener) { return this.addListener('cancely', listener); }
  onSlideUp(listener) { return this.addListener('slideup', listener); }
  onSlideDown(listener) { return this.addListener('slidedown', listener); }
  onSlideLeft(listener) { return this.addListener('slideleft', listener); }
  onSlideRight(listener) { return this.addListener('slideright', listener); }
}

export class TouchMoveListener {
  /**
   * @param {HTMLElement} element
   */
  constructor(element) {
    this.element = element;
    /** @type {((x: number, y: number) => any)[]} */
    this.touchMoveCallbackList = [];
    /** @type {((x: number, y: number) => any)[]} */
    this.touchStartCallbackList = [];
    /** @type {(() => any)[]} */
    this.touchEndCallbackList = [];
    /** @type {(() => any)[]} */
    this.touchCancelCallbackList = [];

    let mouseDown = false, touchStart = false;
    const addGlobalMouseHandlers = () => {
      document.addEventListener('mouseup', mouseUpHandler);
      document.addEventListener('mouseleave', mouseCancelHandler);
      document.addEventListener('mousemove', mouseMoveHandler);
    };
    const removeGlobalMouseHandlers = () => {
      document.removeEventListener('mouseup', mouseUpHandler);
      document.removeEventListener('mouseleave', mouseCancelHandler);
      document.removeEventListener('mousemove', mouseMoveHandler);
    };
    const mouseDownHandler = event => {
      if (touchStart) {
        touchStart = false;
        return;
      }
      if (event.button !== 0) return;
      mouseDown = true;
      this.triggerCallback('start', { position: [event.pageX, event.pageY], touch: false });
      addGlobalMouseHandlers();
    };
    const mouseUpHandler = event => {
      if (mouseDown) this.triggerCallback('end', { touch: false });
      mouseDown = false;
      removeGlobalMouseHandlers();
    };
    const mouseCancelHandler = event => {
      if (mouseDown) this.triggerCallback('cancel', { touch: false });
      mouseDown = false;
      removeGlobalMouseHandlers();
    };
    const mouseMoveHandler = event => {
      if (!mouseDown) return;
      if (event.button !== 0) {
        mouseCancelHandler();
      } else {
        this.triggerCallback('move', { position: [event.pageX, event.pageY], touch: false });
      }
    };
    const addGlobalTouchHandlers = () => {
      document.addEventListener('touchend', touchEndHandler);
      document.addEventListener('touchcancel', touchCancelHandler);
      document.addEventListener('touchmove', touchMoveHandler);
    };
    const removeGlobalTouchHandlers = () => {
      document.removeEventListener('touchend', touchEndHandler);
      document.removeEventListener('touchcancel', touchCancelHandler);
      document.removeEventListener('touchmove', touchMoveHandler);
    };
    const touchStartHandler = event => {
      if (event.touches.length > 1) return;
      touchStart = true;
      const touch = event.touches.item(0);
      this.triggerCallback('start', { position: [touch.pageX, touch.pageY], touch: true });
      addGlobalTouchHandlers();
    };
    const touchEndHandler = event => {
      if (touchStart) this.triggerCallback('end', { touch: true });
      removeGlobalTouchHandlers();
    };
    const touchCancelHandler = event => {
      if (touchStart) this.triggerCallback('cancel', { touch: true });
      removeGlobalTouchHandlers();
    };
    const touchMoveHandler = event => {
      const touch = event.touches.item(0);
      if (touchStart) this.triggerCallback('move', { position: [touch.pageX, touch.pageY], touch: true });
    };

    this.element.addEventListener('mousedown', mouseDownHandler);
    this.element.addEventListener('touchstart', touchStartHandler, { passive: true });
    const dispatch = () => {
      this.element.removeEventListener('mousedown', mouseDownHandler);
      removeGlobalMouseHandlers();
      this.element.removeEventListener('touchstart', touchStartHandler, { passive: true });
      removeGlobalTouchHandlers();
    };

    this.dispatch = dispatch;
  }
  /**
   * @param {'move'|'start'|'end'|'cancel'} type
   * @param {{ position: [number, number], touch: boolean }} data
   */
  triggerCallback(type, data) {
    const callbackList = {
      move: this.touchMoveCallbackList,
      start: this.touchStartCallbackList,
      end: this.touchEndCallbackList,
      cancel: this.touchCancelCallbackList,
    }[type];
    callbackList.forEach(callback => {
      callback(data);
    });
  }
  /** @param {(x: number, y: number) => any} callback */
  onTouchMove(callback) {
    this.touchMoveCallbackList.push(callback);
  }
  /** @param {(x: number, y: number) => any} callback */
  onTouchStart(callback) {
    this.touchStartCallbackList.push(callback);
  }
  /** @param {() => any} callback */
  onTouchEnd(callback) {
    this.touchEndCallbackList.push(callback);
  }
  /** @param {() => any} callback */
  onTouchCancel(callback) {
    this.touchCancelCallbackList.push(callback);
  }
}

