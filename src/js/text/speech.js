/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import config from '../data/config.js';

const speech = {};

export default speech;

const voiceListChangeCallback = [];
const voiceListChangeCallbackOnce = [];
const preferVoiceChangeCallback = [];
const preferVoiceChangeCallbackOnce = [];

/** @type {SpeechSynthesisVoice[]} */
let voiceList = null;
/** @type {string} */
let preferVoiceUri = (void 0);
/** @type {SpeechSynthesisVoice} */
let preferVoice = null;

const langIndex = lang => {
  const languages = navigator.languages;
  const len = languages.length;
  const index = languages.indexOf(lang);
  if (index !== -1) return index;
  const prefix = languages.map(lang => lang.split(/[-_]/)[0]);
  const prefixIndex = prefix.indexOf(lang.split(/[-_]/)[0]);
  if (prefixIndex !== -1) return len + prefixIndex;
  return len * 2;
};
const voiceCmp = (a, b) => {
  return langIndex(a.lang) - langIndex(b.lang) ||
    a.lang.localeCompare(b.lang) ||
    a.name.localeCompare(b.name);
};

const updateVoiceList = function () {
  voiceList = speechSynthesis.getVoices();
  voiceList.sort(voiceCmp);
  voiceListChangeCallback.forEach(callback => {
    callback(voiceList);
  });
  voiceListChangeCallbackOnce.splice(0).forEach(callback => {
    callback(voiceList);
  });
};

speech.onVoiceListChange = function (callback) {
  voiceListChangeCallback.push(callback);
};

speech.getVoiceList = function () { return voiceList; };
/** @returns {Promise<SpeechSynthesisVoice[]>} */
speech.getVoiceListAsync = async function () {
  if (voiceList != null) return voiceList;
  return new Promise(resolve => {
    voiceListChangeCallbackOnce.push(() => {
      resolve(speechSynthesis.getVoices());
    });
  });
};

const updatePreferVoice = function () {
  let voice = null;
  if (voiceList && preferVoiceUri) {
    voice = voiceList.find(voice => voice.voiceURI === preferVoiceUri);
  }
  if (voiceList && preferVoiceUri === null) {
    voice = voiceList.find(voice => voice.default);
    if (!voice && voiceList.length) {
      voice = voiceList[0];
    }
  }
  if (voice !== preferVoice) {
    preferVoice = voice;
    preferVoiceChangeCallback.forEach(callback => {
      callback(voice);
    });
    preferVoiceChangeCallbackOnce.splice(0).forEach(callback => {
      callback(voice);
    });
  }
};

speech.onVoiceListChange(updatePreferVoice);
; (async function () {
  preferVoiceUri = await config.get('speech_voice') || null;
  updatePreferVoice();
}());
config.addListener('speech_voice', uri => {
  preferVoiceUri = uri;
  updatePreferVoice();
});

speech.onPreferVoiceChange = function (callback) {
  preferVoiceChangeCallback.push(callback);
};
speech.getPreferVoice = function () {
  return preferVoice;
};
/** @returns {Promise<SpeechSynthesisVoice>} */
speech.getPreferVoiceAsync = async function () {
  if (preferVoice != null) return preferVoice;
  return new Promise(resolve => {
    preferVoiceChangeCallbackOnce.push(resolve);
  });
};

let speechPitch = 1, speechRate = 1;
config.get('speech_pitch', '1').then(pitch => {
  speechPitch = Number(pitch);
  config.addListener('speech_pitch', pitch => {
    speechPitch = Number(pitch);
  });
});
config.get('speech_rate', '1').then(rate => {
  speechRate = Number(rate);
  config.addListener('speech_rate', rate => {
    speechRate = Number(rate);
  });
});

speech.prepare = function (text) {
  const ssu = new SpeechSynthesisUtterance(text);
  ssu.voice = preferVoice;
  ssu.rate = speechRate;
  ssu.pitch = speechPitch;
  ssu.lang = preferVoice.lang;
  return ssu;
};

speech.setPreferVoice = function (voiceURI) {
  config.set('speech_voice', voiceURI);
};

setTimeout(() => {
  updateVoiceList();
  try {
    speechSynthesis.addEventListener('voiceschanged', updateVoiceList);
  } catch (e) {
    // ignore
  }
}, 0);

