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

const encodings = [
  { encoding: 'utf-8', fatal: true },
  { encoding: 'gbk', fatal: true },
  { encoding: 'big5', fatal: true },
  { encoding: 'utf-16le', fatal: true },
  { encoding: 'utf-16be', fatal: true },
  { encoding: 'utf-8', fatal: false },
];

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
text.readFile = async function (file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', event => {
      const result = reader.result;
      const text = encodings.reduce((text, { encoding, fatal }) => {
        if (text != null) return text;
        const decoder = new TextDecoder(encoding, { fatal });
        try {
          return decoder.decode(result);
        } catch (e) {
          return null;
        }
      }, null);
      if (text) resolve(text);
      reject(null);
    });
    reader.addEventListener('error', event => {
      reject(reader.error);
    });
    reader.readAsArrayBuffer(file);
  });
};

text.parseFilename = function (filename) {
  return filename.replace(/\.[^.]+$/, '');
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
 * @param {number} limit
 */
text.generateContent = function (article, template, limit = 10000) {
  const maxLength = 100;
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
  const setting = await config.get('max_empty_lines');
  if (setting === 'disable') return text;
  const max = Number(setting);
  return text.replace(new RegExp(`(?:\\n\\s*){${max},}\\n`, 'g'), '\n'.repeat(max + 1));
};

const chineseConvert = async function (text) {
  const setting = await config.get('chinese_convert');
  if (setting === 'disable') return text;
  const convertFile = setting === 's2t' ? './data/han/s2t.json' : './data/han/t2s.json';
  const table = await fetch(convertFile).then(r => r.json()), root = table[0];
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

