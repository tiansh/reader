/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import storage from './storage.js';

const file = {};

export default file;

file.add = async function ({ title, content }) {
  const time = new Date();
  const meta = {
    title,
    createTime: time,
    lastAccessTime: time,
    length: content.length,
  };
  await storage.files.add(meta, content);
  return meta;
};

file.list = async function () {
  return storage.files.list();
};

file.getMeta = async function (id) {
  return storage.files.getMeta(id);
};

file.setMeta = async function (meta) {
  meta.lastAccessTime = new Date();
  return storage.files.setMeta(meta);
};

file.getIndex = async function (id) {
  return storage.files.getIndex(id);
};

file.setIndex = async function (index) {
  return storage.files.setIndex(index);
};

file.content = async function (id) {
  return storage.files.getContent(id);
};

file.remove = async function (id) {
  return storage.files.remove(id);
};

