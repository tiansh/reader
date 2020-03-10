/** @typedef {[number, number]} Point */
/** @typedef {'x'|'y'} Direction */

export default class TouchListener {
  constructor(targetElement, { minDistanceX = 20, minDistanceY = 20, clickParts = 3, yRadian = Math.PI / 2 } = {}) {
    this.listeners = new Map();
    this.minDistanceX = minDistanceX;
    this.minDistanceY = minDistanceY;
    this.minDistance = Math.min(minDistanceX, minDistanceY);
    this.clickParts = clickParts;

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
    const handlers = {};
    handlers.start = ([x, y]) => {
      startPos = [x, y];
      lastPos = [x, y];
      direction = null;
    };
    handlers.cancel = () => {
      if (direction) {
        const action = direction === 'x' ? 'cancelx' : 'cancely';
        this.trigger(action);
      }
      startPos = null;
      lastPos = null;
      direction = null;
    };
    handlers.move = ([x, y]) => {
      if (!startPos) return;
      const [dx, dy] = [x - startPos[0], y - startPos[1]];
      lastPos = [x, y];
      if (direction === null) {
        direction = calculateDirection([dx, dy]);
      }
      if (direction) {
        const offset = direction === 'x' ? dx : dy;
        const action = direction === 'x' ? 'movex' : 'movey';
        this.trigger(action, offset);
      }
    };
    handlers.end = () => {
      if (!lastPos || !startPos) {
        handlers.cancel();
        return;
      }
      const [dx, dy] = [lastPos[0] - startPos[0], lastPos[1] - startPos[1]];
      const offset = direction === 'x' ? dx : direction === 'y' ? dy : 0;
      if (!direction) {
        const parts = this.clickParts;
        const x = startPos[0], w = window.innerWidth;
        let action = 'touch';
        if (parts === 2) {
          action = ['touchleft', 'touchright'][Math.floor(x * 2 / w)];
        } else if (parts === 3) {
          action = ['touchleft', 'touchmiddle', 'touchright'][Math.floor(x * 3 / w)];
        }
        this.trigger(action);
      } else {
        const minDistanceArrow = direction === 'x' ? this.minDistanceX : this.minDistanceY;
        if (Math.abs(offset) < minDistanceArrow) {
          const action = direction === 'x' ? 'cancelx' : 'cancely';
          this.trigger(action);
        } else {
          const action = direction === 'x' ? dx > 0 ? 'slideright' : 'slideleft' :
            dy > 0 ? 'slidedown' : 'slideup';
          this.trigger(action);
        }
      }
      startPos = null;
      lastPos = null;
      direction = null;
    };
    /** @type {(type: string) => (event: TouchEvent) => any} */
    const touchEvent = type => event => {
      if (event.touches.length === 1) {
        const touch = event.touches.item(0);
        const position = [touch.pageX, touch.pageY];
        handlers[type](position);
      } else if (type === 'end') {
        handlers.end();
      }
      if (type === 'start') {
        isTouch = true;
      }
    };
    /** @type {(type: string) => (event: MouseEvent) => any} */
    const mouseEvent = type => event => {
      if (event.button !== 0) return;
      if (!isTouch) {
        const position = [event.pageX, event.pageY];
        handlers[type](position);
      }
      if (type === 'end') {
        isTouch = false;
      }
    };
    const removeEventListeners = [];
    const listen = (event, handler) => {
      targetElement.addEventListener(event, handler);
      removeEventListeners.push(() => {
        targetElement.removeEventListener(event, handler);
      });
    };
    listen('touchstart', touchEvent('start'));
    listen('touchend', touchEvent('end'));
    listen('touchcancel', touchEvent('cancel'));
    listen('touchmove', touchEvent('move'));
    listen('mousedown', mouseEvent('start'));
    listen('mouseup', mouseEvent('end'));
    listen('mouseleave', mouseEvent('cancel'));
    listen('mousemove', mouseEvent('move'));
    this.dispatch = () => {
      removeEventListeners.forEach(r => { r(); });
    };
  }
  trigger(action, offset = null) {
    if (!this.listeners.has(action)) return;
    this.listeners.get(action).forEach(listener => {
      listener(offset);
    });
  }
  addListener(action, listener) {
    if (!this.listeners.has(action)) {
      this.listeners.set(action, []);
    }
    this.listeners.get(action).push(listener);
  }
  onTouch(listener) { return this.addListener('touch', listener); }
  onTouchLeft(listener) { return this.addListener('touchleft', listener); }
  onTouchRight(listener) { return this.addListener('touchright', listener); }
  onTouchMiddle(listener) { return this.addListener('touchmiddle', listener); }
  onMoveX(listener) { return this.addListener('movex', listener); }
  onMoveY(listener) { return this.addListener('movey', listener); }
  onCancelX(listener) { return this.addListener('cancelx', listener); }
  onCancelY(listener) { return this.addListener('cancely', listener); }
  onSlideUp(listener) { return this.addListener('slideup', listener); }
  onSlideDown(listener) { return this.addListener('slidedown', listener); }
  onSlideLeft(listener) { return this.addListener('slideleft', listener); }
  onSlideRight(listener) { return this.addListener('slideright', listener); }
}

