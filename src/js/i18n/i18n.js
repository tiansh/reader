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

/** @typedef {en} Locale */
/** @typedef {keyof typeof en} LocaleKey */

/** @template {T} @type {(lang: Locale, base: Locale) => Locale} */
const fallback = (lang, base = null) => Object.assign(Object.create(base), lang);

const locales = [
  { name: /^en\b/i, lang: 'en', locale: fallback(en) },
  { name: /^zh\b(?:(?!.*-Hans)-(?:TW|HK|MO)|.*-Hant|$)/i, lang: 'zh-TW', locale: fallback(zh_TW, en) },
  { name: /^zh\b/i, lang: 'zh-CN', locale: fallback(zh_CN, en) },
];

const defaultLocale = (function () {
  const languages = navigator.languages;
  /** @type {locales[number]} */
  const prefer = languages.reduce((match, lang) => {
    return match ?? locales.find(locale => locale.name.test(lang));
  }, null) ?? locales[0];
  return prefer;
}());

let currentLocale = defaultLocale;
let localized = false;

const i18n = {};

export default i18n;

/**
 * @param {LocaleKey} name
 */
i18n.getMessage = function (name, ...placeholders) {
  localized = true;
  const message = currentLocale.locale[name];
  if (typeof message === 'string') {
    return message.replace(/\{\d+\}/g, p => String(placeholders[parseInt(p.slice(1), 10)]));
  } else if (typeof message === 'function') {
    return String(message(...placeholders));
  } else {
    return '';
  }
};

i18n.listLocales = function () {
  return locales.map(locale => ({
    id: locale.lang,
    name: locale.locale.localeName,
  })).sort((x, y) => x.id.localeCompare(y.id, 'en'));
};

i18n.setLocale = function (id) {
  if (localized) return false;
  const selected = locales.find(locale => locale.lang === id);
  if (!selected) return false;
  currentLocale = selected;
  return true;
};
