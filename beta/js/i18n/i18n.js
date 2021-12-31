/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import en from './locale/en.js';
import zh_CN from './locale/zh_cn.js';
import zh_TW from './locale/zh_tw.js';

const locales = [
  { name: /^en\b/i, lang: 'en', locale: en },
  { name: /^zh\b(?:-(?!.*-Hans)(?:TW|HK|MO)|.*-Hant|$)/i, lang: 'zh-TW', locale: zh_TW },
  { name: /^zh\b/i, lang: 'zh-CN', locale: zh_CN },
];

/** @type {en} */
const prefer = (function () {
  const languages = navigator.languages;
  const prefer = languages.reduce((match, lang) => {
    return match ?? locales.find(locale => locale.name.test(lang));
  }, null) ?? locales[0];
  document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.lang = prefer.lang;
  });
  return Object.assign({}, en, prefer.locale);
}());

const i18n = {};

export default i18n;

/**
 * @param {keyof typeof prefer} name
 */
i18n.getMessage = function (name, ...placeholders) {
  const message = Object.prototype.hasOwnProperty.call(prefer, name) ? prefer[name] : en[name];
  if (typeof message === 'string') {
    return message.replace(/\{\d+\}/g, p => String(placeholders[parseInt(p.slice(1), 10)]));
  } else if (typeof message === 'function') {
    return String(message(...placeholders));
  } else {
    return '';
  }
};


