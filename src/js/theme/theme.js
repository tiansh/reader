/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import config from '../data/config.js';

const theme = {};

export default theme;

const callbackList = [];
const triggerCallback = function (isLight) {
  callbackList.forEach(callback => {
    callback(isLight ? 'light' : 'dark');
  });
};

let currentTheme = 'dark';
let autoUseLight = false;
let lastTheme = null;
const updateTheme = function () {
  const useLightTheme = currentTheme === 'light' || currentTheme === 'auto' && autoUseLight;
  if (useLightTheme === lastTheme) return;
  lastTheme = useLightTheme;
  triggerCallback(useLightTheme);
};
const updateAutoTheme = function (useLightTheme) {
  autoUseLight = useLightTheme;
  updateTheme();
};
const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
updateAutoTheme(mediaQuery.matches);
mediaQuery.addListener(event => { updateAutoTheme(event.matches); });
const updateConfigTheme = theme => {
  currentTheme = theme;
  updateTheme();
};
config.addListener('theme', updateConfigTheme);
config.get('theme', 'auto').then(updateConfigTheme);

theme.getCurrent = function () {
  const useLightTheme = currentTheme === 'light' || currentTheme === 'auto' && autoUseLight;
  return useLightTheme ? 'light' : 'dark';
};

theme.addChangeListener = function (callback) {
  if (callbackList.includes(callback)) return;
  callbackList.push(callback);
};

theme.removeChangeListener = function (callback) {
  const pos = callbackList.indexOf(callback);
  if (pos !== -1) callbackList.splice(pos, 1);
};

