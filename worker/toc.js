/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

// Maximum number of content items to process. Beyond this, content is ignored.
const MAX_CONTENTS_LENGTH = 2000;
// Minimum number of content items required for valid analysis.
const MIN_CONTENTS = 3;
// Maximum tokens analyzed per section or line to limit complexity.
const MAX_SECTION = 15;
// Maximum length for a valid title. Longer titles are considered invalid.
const MAX_TITLE_LENGTH = 100;
// Maximum average length for valid titles.
const MAX_MEAN_TITLE_LENGTH = 80;
// Sensitivity to content size variations. Smaller values increase strictness.
const FACTOR_CONTENTS_SIZE = 4;
// Sensitivity to outlier sizes in sections. Higher values allow larger variations.
const FACTOR_OUTLIER = 10;
// Sensitivity to inconsistent content sizes. Lower values make checks stricter.
const FACTOR_VARIANCE_SIZE = 5;
// Defines how much larger an outlier can be before being flagged as invalid.
const OUTLIER_DISTANCE = 3;
// Sensitivity to invalid titles (e.g., overly long or duplicate titles). Lower values increase strictness.
const FACTOR_TITLE_INVALID = 8;
// Maximum number of duplicate TOC titles allowed. Set to 0 to disallow duplicates.
const TOC_DUPLICATE_TOLERATE = 1;
// Maximum numeric patterns recognized on a single line to prevent over-complexity.
const MAX_NUMERIC_LINE = 2;
// Sensitivity to large numbers in content. Higher values allow larger numbers to pass.
const FACTOR_NUMBER_MAX = 4;
// Sensitivity to skipped or missing numbers in sequences. Smaller values increase strictness.
const FACTOR_NUMBER_HOLES = 5;
// Sensitivity to invalid number sequences (e.g., unordered numbers). Lower values increase strictness.
const FACTOR_NUMBER_INVALID = 7;
// Sensitivity to the uniqueness of prefix patterns. Higher values emphasize unique prefixes.
const KEYWORD_UNIQUE_FACTOR = 5;
// Sensitivity to skipped prefix items. Lower values enforce stricter prefix patterns.
const KEYWORD_PREFIX_FACTOR = 3;
// Minimum beauty score required to pass the first stage of content analysis.
const BEAUTY_MIN_1 = 0.1;
// Minimum ratio of lines that must share a prefix pattern for it to be considered valid.
const PREFIX_MIN_RATIO = 0.45;
// Maximum number of number-based templates selected during the first stage of analysis.
const TEMPLATE_NUMBER_COUNT_1 = 30;
// Maximum number of prefix-based templates selected during the first stage of analysis.
const TEMPLATE_PREFIX_COUNT_1 = 10;
// Sensitivity to mismatches between patterns and content. Smaller values increase strictness.
const FACTOR_MISMATCH = 8;
// Minimum beauty score required for a content template to be suggested or selected.
const BEAUTY_MIN_2 = 0.16;
// Regex to recognize symbol
const SYMBOL_REGEX = /[^\p{L}\p{N}]/ug;
// Regex to recognize tokens
const TOKEN_REGEX = /(?:\p{Script=Latn}+|\p{Script=Cyrl}+|\p{Script=Grek}+|\p{Script=Geor}+|\p{Script=Armn}+|\p{Script=Arab}+|\p{Script=Tibetan}+|\p{Number}+|.)/gsu;


/**
 * Ensure that chapter should have similar size
 * @param {{ title: string; cursor: number }[]} contents Size of each section of the book
 * @param {{ chars: number }} context The whole article
 * @returns number probability the selection is a chapter
 */
const contentsBeautyBySize = function (contents, { chars: totalChars }) {
  if (contents.length > MAX_CONTENTS_LENGTH) return 0;

  const titleChars = contents.reduce((s, c) => s + c.title.length, 0);
  const starts = [0, ...contents.map(content => content.cursor + content.title.length)];
  const ends = [...contents.map(content => content.cursor), totalChars];
  const chapters = ends.map((end, i) => Math.max(end - starts[i], 0));
  if (OUTLIER_DISTANCE * Math.max(...chapters.slice(0, -1)) < chapters[chapters.length - 1]) chapters.pop();
  const length = chapters.length - 1;
  if (length < 3) return 0;

  const values = chapters.slice(1).sort((a, b) => a - b);
  const at = (/** @type {number} */n) => (n < 0 ? values[0] : n > values.length - 1 ? values[values.length - 1] :
    values[Math.floor(n)] * (1 - n % 1) + values[Math.ceil(n)] * (n % 1));
  const acc = values.reduce((a, x) => [...a, a[a.length - 1] + x], [0]);
  const sum = (first, last) => acc[last] - acc[first];
  const bound = (v, l = 0, h = length, m = Math.floor((l + h) / 2)) => l < h ? values[m] < v ? bound(v, m + 1, h) : bound(v, l, m) : l;

  const vLeft = at((length - 1) * 0.25), vRight = at((length - 1) * 0.75);
  let low = Math.max(Math.floor(vLeft / 2 ** OUTLIER_DISTANCE) - 1, titleChars / length, 1), leftIndex = bound(low), left = at(leftIndex);
  let high = Math.ceil(vRight * 2 ** OUTLIER_DISTANCE) + 1, rightIndex = bound(high), right = at(rightIndex);
  let mid = Math.ceil((left + right) / 2), centerIndex = bound(mid), center = at(centerIndex);
  if (low > high) return 0;

  for (let iterate = 0; iterate < 10; iterate++) {
    if (center === left || center === right) break;
    const leftSum = sum(leftIndex, centerIndex), leftLen = centerIndex - leftIndex, leftMean = leftSum / leftLen;
    const rightSum = sum(centerIndex, rightIndex), rightLen = rightIndex - centerIndex, rightMean = rightSum / rightLen;
    const newMid = Math.ceil(leftMean + rightMean) / 2, newCenterIndex = bound(newMid);
    if (newCenterIndex === centerIndex) break;
    mid = newMid, centerIndex = newCenterIndex, center = at(centerIndex);
  }
  const rate = (first, last) => {
    if (first === last) return 0;
    const s = sum(first, last), n = last - first, m = s / n, c = bound(m);
    const l = (c - first) * m - sum(first, c), r = sum(c, last) - (last - c) * m;
    const t = (l + r) / s;
    return t ** 2;
  };
  const factors = [
    (1 / FACTOR_OUTLIER) ** (length / (rightIndex - leftIndex) - 1),
    (1 / FACTOR_OUTLIER) ** (totalChars / (titleChars + sum(leftIndex, rightIndex)) - 1),
    (1 / FACTOR_VARIANCE_SIZE) ** rate(leftIndex, centerIndex),
    (1 / FACTOR_VARIANCE_SIZE) ** rate(centerIndex, rightIndex),
  ];
  return factors.reduce((x, y) => x * y, 1);
};

/**
 * Ensure that title of contents have proper length and not duplicate
 * @param {{ title: string; cursor: number }[]} contents
 * @returns {number}
 */
const contentsBeautyByTitle = function (contents) {
  const length = contents.length;
  if (length < MIN_CONTENTS) return 0;
  if (length > MAX_CONTENTS_LENGTH) return 0;
  const nameSet = new Map();
  let totalSize = 0, totalCount = 0;
  const validSize = contents.filter(({ title }) => {
    if (title.length > MAX_TITLE_LENGTH) return false;
    const count = nameSet.has(title) ? nameSet.get(title) : 0;
    nameSet.set(title, count + 1);
    if (count > TOC_DUPLICATE_TOLERATE) return false;
    totalSize += title.length; totalCount++;
    return true;
  }).length;
  const meanSize = (totalSize + 1) / totalCount;
  const factors = [
    (1 / FACTOR_CONTENTS_SIZE) ** (1 / totalCount),
    (1 / FACTOR_TITLE_INVALID) ** (length / validSize - 1) ** 0.5,
    2 * (MAX_MEAN_TITLE_LENGTH - meanSize) / MAX_MEAN_TITLE_LENGTH - (Math.exp(-meanSize / MAX_MEAN_TITLE_LENGTH) - 1 / Math.E) / (1 - 1 / Math.E),
  ];
  return factors.reduce((x, y) => x * y);
};

/**
 * @param {{ title: string; cursor: number; number: number }[]} contents Size of each section of the book
 * @returns {number}
 */
const contentsBeautyByNumber = function (contents) {
  const numbers = contents.map(x => x && x.number);
  const length = numbers.length;
  if (length < MIN_CONTENTS) return 0;
  const best = [];
  const prev = numbers.map((n, i) => {
    if (n === null) return null;
    if (!best.length || numbers[best[best.length - 1]] <= n) {
      best.push(i);
      if (best.length === 1) return null;
      return best[best.length - 2];
    } else {
      let l = 0, h = best.length - 1, m;
      while (l < h) {
        m = Math.floor(l + h) / 2;
        if (numbers[best[m]] <= n) l = m + 1; else h = m;
      }
      best[l] = i;
      return l ? best[l - 1] : null;
    }
  });
  const seq = Array(best.length);
  for (let i = best.length - 1, n = best[i]; i >= 0; i--, n = prev[n]) seq[i] = numbers[n];
  const size = seq.length, max = seq[seq.length - 1], min = Math.min(seq[0], 1);
  if (!max) return 0;
  let holes = max - min + 1, seen = new Set();
  seq.forEach(n => !seen.has(n) && (seen.add(n), holes--));
  const factors = [
    (1 / FACTOR_NUMBER_MAX) ** (1 / max ** 2),
    (1 / FACTOR_NUMBER_INVALID) ** (length / size - 1),
    (1 / FACTOR_NUMBER_HOLES) ** (max / (max - holes) - 1),
  ];
  return factors.reduce((x, y) => x * y);
};

/**
 *
 * @param {{ context: { tokens: string[] } }[]} contents
 * @param {{ prefixCounts: Map<string, number>; symbolCounts: Map<string, number> }} articleContext
 */
const contentsBeautyByPrefix = function (contents, articleContext) {
  if (!contents.length) return 0;
  const token = contents[0].context.tokens[0];
  const totalLines = articleContext.symbolCounts.get(token);
  const prefixLines = articleContext.prefixCounts.get(token);
  const size = contents.length;
  const factors = [
    (size / totalLines) ** (KEYWORD_UNIQUE_FACTOR / 10),
    (size / prefixLines) ** (KEYWORD_PREFIX_FACTOR / 10),
  ];
  return factors.reduce((x, y) => x * y);
};

const exactRegex = (/** @type {string} */str) => str.replace(/[\\^$.*+?()[\]{}|\s]/g, c => /\s/.test(c) ? c === ' ' ? c : '\\s' : '\\' + c);


/**
 * @param {object} config
 * @param {{ key: string; optional: string }} config.charset
 * @param {(key: string) => string} config.regex
 * @param {(str: string) => number} config.parser
 * @param {string} config.group
 * @param {number} config.priority
 */
const extractNumber = function ({ charset, regex, parser, group, priority }) {
  const matcher = new RegExp(regex(charset.key, charset.optional), 'g');
  return {
    extract: function (/** @type {string} */str) {
      const matches = [];
      for (let index = 0, match; index < MAX_NUMERIC_LINE && (match = matcher.exec(str)); index++) {
        const prefix = str.slice(0, match.index);
        const infix = match[0];
        const number = parser(infix);
        const suffix = str.slice(match.index + infix.length);
        if (!Number.isFinite(number)) return null;
        matches.push({ prefix, infix, suffix, number });
      }
      matcher.lastIndex = 0;
      return matches;
    },
    charset,
    regex,
    group,
    priority,
  };
};

const hanMap = {
  0: 0, '０': 0, 〇: 0, 零: 0, 一: 1, 二: 2, 两: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 百: 100, 千: 1000,
  壹: 1, 贰: 2, 叁: 3, 肆: 4, 伍: 5, 陆: 6, 柒: 7, 捌: 8, 玖: 9, 拾: 10, 貳: 2, 參: 3, 陸: 6, 佰: 100, 仟: 1000,
};

/**
 * @param {string} text
 * @returns number
 */
const parseHanNumber = function parse(text) {
  let result = 0, current = 0;
  for (const ch of text) {
    const val = hanMap[ch];
    if (val >= 10) {
      result += (current || 1) * val;
      current = 0;
    } else {
      current = current * 10 + val;
    }
  }
  return result + current;
};


const hanCharset1 = { key: '零〇一二三四五六七八九十百千', optional: '0０两兩' };
const hanCharset2 = { key: '零壹贰貳叁參肆伍陆陸柒捌玖拾佰仟', optional: '' };
const hanCharset3 = { key: hanCharset1.key + hanCharset2.key, optional: hanCharset1.optional + hanCharset2.optional };

const parseHan1 = extractNumber({ charset: hanCharset1, regex: chars => `[${chars}]+`, parser: parseHanNumber, group: 'han', priority: 1 });
const parseHan2 = extractNumber({ charset: hanCharset2, regex: chars => `[${chars}]+`, parser: parseHanNumber, group: 'han', priority: 1 });
const parseHan3 = extractNumber({ charset: hanCharset3, regex: chars => `[${chars}]+`, parser: parseHanNumber, group: 'han', priority: 2 });

/**
 * @param {string} text
 * @returns number
 */
const parseNumericNumber = function (text) {
  return Number.parseInt(text.normalize('NFKC'), 10);
};

const parseNumeric1 = extractNumber({ charset: { key: '0123456789', optional: '' }, regex: chars => `[${chars}]+`, parser: parseNumericNumber, group: 'numeric', priority: 1 });
const parseNumeric2 = extractNumber({ charset: { key: '０１２３４５６７８９', optional: '' }, regex: chars => `[${chars}]+`, parser: parseNumericNumber, group: 'numeric', priority: 1 });

const numberParserList = [
  parseHan1,
  parseHan2,
  parseHan3,
  parseNumeric1,
  parseNumeric2,
].map((p, index) => Object.assign({ index }, p));

/**
 *
 * @param {string} article
 * @param {{ chars: number; prefixCounts: Map<string, number>; symbolCounts: Map<string, number>; lines: { line: string; tokens: string[]; numbers: number[] }[] }} articleContext
 */
const recognizeContents = function (article, articleContext = {}) {
  /** @type {({ mismatch: RegExp; pattern: string; key: string; priority: number; beauty: number } & ({ type: 'number'; parser: typeof numberParserList[number]; prefix: string } | { type: 'prefix', prefixBeauty: number }))[]} */
  const patterns = [], seenPattern = new Set();
  const commitPattern = (/** @type {typeof patterns[number]} */config) => {
    if (seenPattern.has(config.key)) return;
    if (config.beauty < BEAUTY_MIN_1) return;
    seenPattern.add(config.key);
    patterns.push(config);
  };

  Object.assign(articleContext, {
    chars: 0,
    symbolCounts: new Map(),
    prefixCounts: new Map(),
    lines: [],
  });
  /** @typedef {(ReturnType<typeof numberParserList[number]['extract']>)[number] & { cursor: number; title: string }} NumberMatchItem */
  /** @type {Map<string, NumberMatchItem[]>[]} */
  const numberMatching = numberParserList.map(_ => new Map());
  /** @type {Map<string, { cursor: number; title: string; context: { line: string; tokens: RegExpMatchArray | null; } }[]>} */
  const prefixMatching = new Map();

  let cursor = 0;
  const lines = article.split('\n');
  lines.forEach(line => {
    const stripedLine = line.trim();
    const tokens = [];
    for (let tokenMatch; (tokenMatch = TOKEN_REGEX.exec(stripedLine));) {
      if (tokens.push(tokenMatch[0]) === MAX_SECTION) {
        TOKEN_REGEX.lastIndex = 0;
        break;
      }
    }
    const symbols = stripedLine.match(SYMBOL_REGEX);
    const lineContext = { line, tokens };
    articleContext.lines.push(lineContext);
    if (symbols?.length) {
      [...new Set(symbols)].forEach(token => {
        articleContext.symbolCounts.set(token, (articleContext.symbolCounts.get(token) ?? 0) + 1);
      });
    }
    if (tokens.length) {
      const firstToken = tokens[0];
      if (firstToken && SYMBOL_REGEX.test(firstToken)) {
        if (!prefixMatching.has(firstToken)) prefixMatching.set(firstToken, []);
        prefixMatching.get(firstToken).push({ title: line, cursor, context: lineContext });
        articleContext.prefixCounts.set(firstToken, (articleContext.prefixCounts.get(firstToken) ?? 0) + 1);
      }
    }
    if (tokens.length && line.length < MAX_TITLE_LENGTH) {
      const numericLine = tokens.join('');
      numberParserList.forEach((parser, index) => {
        const matchedList = parser.extract(numericLine);
        matchedList.forEach(matched => {
          const context = numberMatching[index];
          const prefix = matched.prefix.trimStart();
          if (!context.has(prefix)) context.set(prefix, []);
          context.get(prefix).push({ ...matched, cursor, title: line });
        });
      });
    }
    cursor += stripedLine.length + 1;
  });
  articleContext.chars = cursor;

  numberMatching.forEach((byPrefix, patternIndex) => {
    const parser = numberParserList[patternIndex];
    const next = {};
    [...byPrefix.entries()].forEach(([prefix, matches]) => {
      if (matches.length < 3) return;
      /** @type {Map<string, NumberMatchItem[]>} */
      const bySuffix = new Map();
      bySuffix.set('', matches);
      matches.forEach(match => {
        const tokens = match.suffix.match(TOKEN_REGEX);
        if (!tokens || !tokens.length) return;
        let suffix = '';
        tokens.forEach(token => {
          next[suffix] = suffix += token;
          if (!bySuffix.has(suffix)) bySuffix.set(suffix, []);
          bySuffix.get(suffix).push(match);
        });
      });
      [...bySuffix.entries()].forEach(([suffix, matches]) => {
        if (matches.length < MIN_CONTENTS) return;
        if (next[suffix] && bySuffix.get(next[suffix])?.length === matches.length) return;
        const beauty1 = contentsBeautyByNumber(matches);
        if (beauty1 < BEAUTY_MIN_1) return;
        const beauty2 = contentsBeautyBySize(matches, articleContext) * contentsBeautyByTitle(matches);
        const beauty = beauty1 * beauty2;
        if (beauty < BEAUTY_MIN_1) return;
        const key = JSON.stringify([parser.index, 1, prefix, suffix]);
        const infixCollection = matches.map(m => m.infix), infixSet = new Set(infixCollection.join(''));
        const pattern = !['/', '*'].some(ch => (prefix + suffix).includes(ch)) ?
          (suffix ? `${prefix}*${suffix}` : prefix).replace(/\s+/g, ' ') :
          (suffix ? `/${exactRegex(prefix)}.*${exactRegex(suffix)}/u` : `/${exactRegex(prefix)}/u`);
        const charset = parser.charset.key + parser.charset.optional.replace(/./g, ch => infixSet.has(ch) ? ch : '');
        const charsetPattern = ([...new Set(charset)]
          .map(ch => ch.charCodeAt())
          .map((ch, i, chs) => ch - 1 === chs[i - 1] && ch + 1 === chs[i + 1] ? null : ch)
          .reduce((p, ch, i, chs) => p + (ch == null ? chs[i - 1] != null ? '-' : '' : exactRegex(String.fromCharCode(ch))), ''));
        const regexKey = JSON.stringify([parser.index, 2, prefix, suffix]);
        const regexPattern = `/^\\s*${exactRegex(prefix)}[${charsetPattern}]+${exactRegex(suffix)}/`;
        const prefixTokens = prefix.match(TOKEN_REGEX) || [], shortPrefix = prefixTokens.slice(-1).join(''), prefixSpace = /\s/.test(prefixTokens[prefixTokens.length - 2]);
        const suffixTokens = suffix.match(TOKEN_REGEX) || [], shortSuffix = suffixTokens.slice(0, 1).join(''), suffixSpace = /\s/.test(suffixTokens[1]);
        const prefixReg = (prefixSpace ? '\\s' : '') + exactRegex(shortPrefix), suffixReg = exactRegex(shortSuffix) + (suffixSpace ? '\\s' : '');
        const mismatch = new RegExp(`${prefixReg}[${charsetPattern}]+${suffixReg}`, 'u');
        if (prefix) commitPattern({ mismatch, pattern, key, priority: parser.priority * 10, type: 'number', parser, beauty, prefix });
        if (prefix || suffix) commitPattern({ mismatch, pattern: regexPattern, key: regexKey, priority: parser.priority * 10 + 1, type: 'number', parser, beauty, prefix });
        if (!prefix && !suffix) {
          const emptyPattern = `/^\\s*${exactRegex(prefix)}[${charsetPattern}]+${exactRegex(suffix)}\\s*$/`;
          commitPattern({ mismatch, pattern: emptyPattern, key: regexKey, priority: parser.priority * 10, type: 'number', parser, beauty, prefix });
        }
      });
    });
  });

  [...prefixMatching.entries()].forEach(([prefix, matches]) => {
    if (matches.length > MAX_CONTENTS_LENGTH / PREFIX_MIN_RATIO) return;
    const totalLines = articleContext.symbolCounts.get(prefix);
    const minTarget = Math.max(MIN_CONTENTS, totalLines * PREFIX_MIN_RATIO);
    const matchLines = matches.length;
    if (matchLines < minTarget) return;
    ; (function findPrefix(prefixTokens, lines) {
      const countNext = new Map(), n = prefixTokens.length;
      lines.forEach(line => {
        if (line.tokens.length >= n) {
          const next = line.tokens[n];
          if (!countNext.has(next)) countNext.set(next, []);
          countNext.get(next).push(line);
        }
      });
      let extendPrefix = false;
      [...countNext.entries()].forEach(([next, newMatches]) => {
        if (newMatches.length < minTarget) return;
        extendPrefix = newMatches.length === lines.length;
        findPrefix([...prefixTokens, next], newMatches);
      });
      if (extendPrefix) return;
      ; (function () {
        const prefix = prefixTokens.join('');
        const pattern = !['/', '*'].some(ch => (prefix).includes(ch)) ? `${prefix}` : `/^\\s*${exactRegex(prefix)}/u`;
        const mismatch = new RegExp(exactRegex(prefix));
        const key = JSON.stringify([null, prefix, '']);
        const beauty1 = contentsBeautyByPrefix(lines, articleContext);
        const beauty2 = contentsBeautyByTitle(lines) * contentsBeautyBySize(lines, articleContext);
        const beauty = beauty1 * beauty2;
        if (beauty < BEAUTY_MIN_1) return;
        commitPattern({ mismatch, pattern, key, priority: 11, type: 'prefix', beauty, prefixBeauty: beauty1 });
      }());
      const suffixList = lines.map(line => line.tokens.slice(prefixTokens.length + 1));
      /** @type {Map<string, string[]>} */
      const tokenCount = new Map();
      suffixList.forEach(suffix => {
        let seen = new Set();
        suffix.forEach((token, index) => {
          if (seen.has(token)) return;
          seen.add(token);
          if (!tokenCount.has(token)) tokenCount.set(token, []);
          tokenCount.get(token).push(suffix.slice(index + 1));
        });
      });
      [...tokenCount.entries()].forEach(([token, sublines]) => {
        if (sublines.length < minTarget) return;
        let lcp = '', lcps = 0;
        while (sublines.every(tokens => tokens[lcps] && tokens[lcps] === sublines[0][lcps])) lcp += sublines[0][lcps++];
        const prefix = prefixTokens.join(''), suffix = token + lcp;
        const selected = matches.filter(match => match.title.includes(suffix));
        const beauty1 = contentsBeautyByPrefix(selected, articleContext);
        if (beauty1 < BEAUTY_MIN_1) return;
        const beauty2 = contentsBeautyByTitle(selected) * contentsBeautyBySize(selected, articleContext);
        const beauty = beauty1 * beauty2;
        if (beauty < BEAUTY_MIN_1) return;
        const pattern = !['/', '*'].some(ch => (prefix + suffix).includes(ch)) ?
          `${prefix}*${suffix}` : `/^\\s*${exactRegex(prefix)}.*${exactRegex(suffix)}/u`;
        const mismatch = new RegExp(exactRegex(prefix) + '.*' + exactRegex(suffix));
        const key = JSON.stringify([null, prefix, suffix]);
        commitPattern({ mismatch, pattern, key, priority: 10, type: 'prefix', beauty, prefixBeauty: beauty1 });
      });
    }([prefix], matches.map(match => Object.assign({ tokens: match.context.tokens.slice(0, MAX_SECTION) }, match))));
  });
  const seen = new Set(), dedupe = patterns.filter(pattern => seen.has(pattern.key) ? false : seen.add(pattern.key));
  const numberPatterns = dedupe.filter(p => p.type === 'number').sort((x, y) => y.beauty - x.beauty).slice(0, TEMPLATE_NUMBER_COUNT_1);
  const prefixPatterns = dedupe.filter(p => p.type === 'prefix').sort((x, y) => y.beauty - x.beauty).slice(0, TEMPLATE_PREFIX_COUNT_1);
  const chosenPatterns = [...numberPatterns, ...prefixPatterns];
  const regexList = chosenPatterns.map(x => parseContentTemplate(x.pattern));
  const mismatchSet = new Map();
  chosenPatterns.map(x => !mismatchSet.has('' + x.mismatch) && mismatchSet.set('' + x.mismatch, x.mismatch));
  const mismatchList = [...mismatchSet.values()];
  const mismatchIndex = chosenPatterns.map(x => mismatchList.findIndex(r => x.mismatch + '' === r + ''));
  const contents = regexList.map(x => []), mismatch = regexList.map(x => 0);
  cursor = 0;
  article.split('\n').forEach(line => {
    const mismatchResult = mismatchList.map(r => r.test(line));
    if (line.length <= MAX_TITLE_LENGTH) {
      regexList.forEach((matchReg, index) => {
        if (matchReg.test(line)) {
          contents[index].push({
            title: line.trim(),
            cursor,
          });
        } else {
          const m = mismatchResult[mismatchIndex[index]];
          if (m) mismatch[index]++;
        }
      });
    } else {
      mismatchIndex.forEach((m, index) => {
        if (mismatchResult[m]) mismatch[index]++;
      });
    }
    cursor += line.length + 1;
  });
  const contentsWithBeauty = contents.map((content, index) => {
    const pattern = chosenPatterns[index];
    const beauty1 = contentsBeautyBySize(content, { chars: cursor }) * contentsBeautyByTitle(content);
    const numbers = pattern.type === 'number' ? content.map(line => pattern.parser.extract(line.title.split(pattern.prefix)[1])[0]) : [];
    const beauty2 = pattern.type === 'number' ? contentsBeautyByNumber(numbers) : pattern.prefixBeauty;
    const beauty3 = (1 / FACTOR_MISMATCH) ** (mismatch[index] / content.length);
    return { content, beauty: beauty1 * beauty2 * beauty3, priority: pattern.priority, pattern };
  });
  contentsWithBeauty.sort((a, b) => b.beauty - a.beauty || a.priority - b.priority || a.pattern.pattern.length - b.pattern.pattern.length);
  const best = contentsWithBeauty[0];
  if (!best || best.beauty < BEAUTY_MIN_2) return null;
  return { items: best.content, template: best.pattern.pattern, beauty: best.beauty };
};


/**
 * @param {string} text
 * @returns {RegExp}
 */
const useRegExpForContent = function (template) {
  if (/\/.*\/[a-zA-Z]*/.test(template)) {
    const [_, reg, flags] = template.match(/\/(.*)\/(.*)/);
    try {
      return new RegExp(reg, flags);
    } catch (e) {
      console.error(e);
      return null;
    }
  }
  return null;
};

/**
 * @param {string} template
 * @returns {RegExp}
 */
const parseContentTemplate = function (template) {
  const matchReg = useRegExpForContent(template);
  if (matchReg) return matchReg;
  const escape = template.replace(/./g, c => {
    if (c === ' ') return '\\s+';
    if (c === '*') return '.*';
    if (c === '?') return '.';
    return c.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,
      c => `\\u${c.charCodeAt().toString(16).padStart(4, 0)}`);
  });
  return new RegExp(`^\\s*(?:${escape})`, 'u');
};

self.addEventListener('message', event => {
  const fileContent = event.data;
  try {
    const result = recognizeContents(fileContent);
    postMessage(result);
  } catch (e) {
    console.error(e);
    postMessage(null);
  }
});

