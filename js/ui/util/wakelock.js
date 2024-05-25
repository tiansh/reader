/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

const wakelock = {};
export default wakelock;

wakelock.isSupport = function () {
  if (!('wakeLock' in navigator)) return false;
  // WakeLock support on iOS standalone mode is buggy
  // We disable the support by checking iOS
  // https://webkit.org/b/254545#c32
  const isIos = ['iPhone', 'iPad'].includes(navigator.platform);
  const isStandalone = window.navigator.standalone;
  const version = navigator.appVersion.split('OS')[1]?.match(/\d+/g);
  if (isIos && isStandalone) return false;
  return true;
};

/** @type {WakeLockSentinel} */
let wakelockSentinel = null;
const onVisibilityChange = async function () {
  if (wakelockSentinel !== null && document.visibilityState === 'visible') {
    wakelockSentinel = await navigator.wakeLock.request('screen');
  }
};
wakelock.request = async function () {
  if (!wakelock.isSupport()) return null;
  wakelockSentinel = await navigator.wakeLock.request('screen');
  document.addEventListener('visibilitychange', onVisibilityChange);
  return true;
};
wakelock.release = async function () {
  if (!wakelockSentinel) return false;
  wakelockSentinel.release();
  wakelockSentinel = null;
  document.removeEventListener('visibilitychange', onVisibilityChange);
  return true;
};
