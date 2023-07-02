/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import config from '../data/config.js';

const text = {};

export default text;

/** @type {Promise<boolean>} */
let compressConfigPromise = null;
const defaultEncodingList = ['utf-8', 'gbk', 'big5', 'utf-16le', 'utf-16be', 'utf-8'];

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
text.readFile = async function (file) {
  const loadContent = new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', async event => {
      resolve(reader.result);
    });
    reader.addEventListener('error', event => {
      reject(reader.error);
    });
    reader.readAsArrayBuffer(file);
  });
  // EXPERT_CONFIG Text encoding when try to decode, use comma split multiple encodings
  const encodingListConfigPromise = config.expert('text.encoding', 'string', '');
  const isCompress = ['application/gzip', 'application/x-gzip'].includes(file.type);
  if (isCompress) try {
    compressConfigPromise = compressConfigPromise ?? new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = './js/lib/pako@2.1.0/pako_inflate.min.js';
      script.addEventListener('error', event => {
        document.body.removeChild(script);
        reject(script);
      });
      script.addEventListener('load', event => { resolve(); });
      document.body.appendChild(script);
    });
  } catch (e) {
    alert('load script fail:', e);
    compressConfigPromise = null;
  }
  const [content, encodingListConfig] =
    await Promise.all([loadContent, encodingListConfigPromise, compressConfigPromise]);
  return new Promise((resolve, reject) => {
    let data = content;
    if (isCompress) data = window.pako.inflate(content);
    const encodingList = encodingListConfig.split(',')
      .map(encoding => encoding.trim()).filter(encoding => encoding);
    const text = [...encodingList, ...defaultEncodingList].reduce((text, encoding, index, fullList) => {
      if (text != null) return text;
      const fatal = ![encodingList.length - 1, fullList.length - 1].includes(index);
      const decoder = new TextDecoder(encoding, { fatal });
      try {
        return decoder.decode(data);
      } catch (e) {
        return null;
      }
    }, null);
    if (text) resolve(text);
    reject(null);
  });
};

text.parseFilename = function (filename) {
  return filename.replace(/\.[^.]+(?:\.gz)?$/, '');
};

/**
 * @param {string} text
 * @returns {RegExp}
 */
text.useRegExpForContent = function (template) {
  if (/\/.*\/[a-zA-Z]*/.test(template)) {
    const [_, reg, flags] = template.match(/\/(.*)\/(.*)/);
    try {
      return new RegExp(reg, flags);
    } catch (e) {
      return null;
    }
  }
  return null;
};

/**
 * @param {string} article
 * @param {string} template
 * @param {{ maxLength: number, limit: number }} details
 */
text.generateContent = function (article, template, { maxLength, limit }) {
  let matchReg = text.useRegExpForContent(template);
  if (!matchReg) {
    const escape = template.replace(/./g, c => {
      if (c === ' ') return '\\s+';
      if (c === '*') return '.*';
      if (c === '?') return '.';
      return c.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,
        c => `\\u${c.charCodeAt().toString(16).padStart(4, 0)}`);
    });
    matchReg = new RegExp(`^\\s*(?:${escape})`, 'u');
  }
  /** @type {{ title: string, cursor: number }[]} */
  const content = [];
  let cursor = 0;
  const limitExceed = article.split('\n').some(line => {
    let match = false;
    if (line.length <= maxLength) {
      if (matchReg.test(line)) {
        if (content.length > limit) {
          return true;
        }
        content.push({
          title: line.trim(),
          cursor,
        });
      }
    }
    cursor += line.length + 1;
    return false;
  });
  if (limitExceed) return null;
  return content;
};

const convertLineEnding = function (text) {
  return text.replace(/\r\n|\r/g, '\n');
};

const maxEmptyLine = async function (text) {
  const setting = await config.get('max_empty_lines', 'disable');
  if (setting === 'disable') return text;
  const max = Number(setting);
  return text.replace(new RegExp(`(?:\\n\\s*){${max},}\\n`, 'g'), '\n'.repeat(max + 1));
};

const chineseConvert = async function (text) {
  const setting = await config.get('chinese_convert', 'disable');
  if (setting === 'disable') return text;
  const convertFile = setting === 's2t' ? './data/han/s2t.json' : './data/han/t2s.json';
  /** @type {{ [ch: string]: [string, number] }[]} */
  const table = await fetch(convertFile).then(r => r.json());
  let output = '';
  let state = 0;
  const hasOwnProperty = Object.prototype.hasOwnProperty;
  for (let char of text) {
    while (true) {
      const current = table[state];
      const hasMatch = hasOwnProperty.call(current, char);
      if (!hasMatch && state === 0) {
        output += char;
        break;
      }
      if (hasMatch) {
        const [adding, next] = current[char];
        if (adding) output += adding;
        state = next;
        break;
      }
      const [adding, next] = current[''];
      if (adding) output += adding;
      state = next;
    }
  }
  while (state !== 0) {
    const current = table[state];
    const [adding, next] = current[''];
    if (adding) output += adding;
    state = next;
  }
  return output;
};

text.preprocess = async function (text) {
  const processors = [convertLineEnding, maxEmptyLine, chineseConvert];
  return processors.reduce(async (text, f) => f(await text), text);
};

