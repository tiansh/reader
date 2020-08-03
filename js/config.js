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

const listenerList = [];

config.get = async name => {
  let value = await storage.config.getItem(name);
  return value;
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


