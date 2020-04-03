import en from './i18n/en.js';
import zh_CN from './i18n/zh_cn.js';

const locales = [
  { name: 'en', locale: en },
  { name: 'zh-CN', locale: zh_CN },
  { name: 'zh-Hans', locale: zh_CN },
];

/** @type {en} */
const prefer = (function () {
  const languages = navigator.languages;
  const prefer = languages.reduce((match, lang) => {
    return match || locales.find(locale => lang.startsWith(locale.name));
  }, null);
  if (prefer) return prefer.locale;
  return en;
}());

const i18n = {};

export default i18n;

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


