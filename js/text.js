const text = {};

export default text;

const encodings = [
  { encoding: 'utf-8', fatal: true },
  { encoding: 'gbk', fatal: true },
  { encoding: 'big5', fatal: true },
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
 * @param {string} template
 */
text.generateContent = function (text, template) {
  const maxLength = 100;
  let matchReg = null;
  if (/\/.*\/[a-zA-Z]*/.test(template)) {
    const [_, reg, flags] = template.match(/\/(.*)\/(.*)/);
    try {
      matchReg = new RegExp(reg, flags);
    } catch (e) {
      matchReg = null;
    }
  }
  if (!matchReg) {
    const escape = template.replace(/./g, c => {
      if (c === ' ') return '\\s+';
      if (c === '*') return '.*';
      if (c === '?') return '.';
      return c.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    });
    matchReg = new RegExp(`^\\s*(?:${escape})`, 'u');
  }
  const content = [];
  let cursor = 0;
  text.split('\n').forEach(line => {
    let match = false;
    if (line.length <= maxLength) {
      if (matchReg.test(line)) {
        content.push({
          title: line.trim(),
          cursor,
        });
      }
    }
    cursor += line.length + 1;
  });
  return content;
};
