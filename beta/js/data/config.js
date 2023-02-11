/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import storage from './storage.js';

const config = {};

export default config;

const EXPERT_CONFIG_NAME = 'expert';
config.EXPERT_CONFIG_NAME = EXPERT_CONFIG_NAME;

const listenerList = [];

config.get = async (name, defaultValue) => {
  let value = await storage.config.getItem(name);
  return value ?? defaultValue;
};

config.set = async (name, value) => {
  await storage.config.setItem(value, name);
  Promise.resolve().then(() => {
    listenerList.forEach(i => {
      if (i.name === name) i.listener(value);
    });
  });
  return value;
};

/**
 * @param {string} key
 * @param {'number'|'string'|'boolean'|'*'} type
 * @param {T} defaultValue
 * @param {{ normalize: () => any, validator: () => any }} details
 * @returns {T}
 * @template T
 */
config.expert = async (key, type, defaultValue, { normalize, validator } = {}) => {
  /** @type {string} */
  const expert = (await config.get(config.EXPERT_CONFIG_NAME)) || '';
  let prefix = '';
  const text = expert.split('\n').filter(text => {
    if (/^\s*\[.*\]\s*$/.test(text)) {
      prefix = text.trim().slice(1, -1);
    } else if (!/^\s*[;#]/.test(text) && text.includes('=')) {
      const name = text.split('=', 1)[0].trim();
      return (prefix ? prefix + '.' + name : name) === key;
    }
    return false;
  }).pop();
  let value = text == null ? defaultValue : text.slice(text.indexOf('=') + 1).trim();
  try {
    value = JSON.parse(value);
  } catch (e) {
    // Use its string value as fallback
  }
  let result = defaultValue;
  try {
    let valid = true;
    if (type === 'number') {
      valid = typeof value === 'number' && (validator ? validator(value) : !Number.isNaN(value));
    } else if (type === 'string') {
      valid = typeof value === 'string' && (!validator || validator(value));
    } else if (type === 'boolean') {
      valid = typeof value === 'boolean' && (!validator || validator(value));
    } else {
      valid = !validator || validator(value);
    }
    if (!valid) return defaultValue;
    result = normalize ? normalize(value, defaultValue) : value;
  } catch (e) {
    // use default
  }
  return result;
};

const findListener = (name, listener) => {
  return listenerList.findIndex(i => i.name === name && i.listener === listener);
};

config.addListener = (name, listener) => {
  const pos = findListener(name, listener);
  if (pos === -1) listenerList.push({ name, listener });
};

config.removeListener = (name, listener) => {
  const pos = findListener(name, listener);
  if (pos !== -1) listenerList.splice(pos, 1);
};


