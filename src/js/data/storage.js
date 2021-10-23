/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

import i18n from '../i18n/i18n.js';

const storage = {};

export default storage;

/**
 * @typedef {Object} ReaderFileMeta
 * @property {IDBValidKey} id
 * @property {string} title
 * @property {Date} createTime
 * @property {Date} lastAccessTime
 * @property {number} cursor
 */
/**
 * @typedef {Object} ReaderFileIndex
 * @property {IDBValidKey} id
 * @property {ReaderFileContent} content
 * @property {ReaderFileBookmarkItem[]} bookmarks
 */
/**
 * @typedef {Object} ReaderFileContent
 * @property {ReaderFileContentItem[]} items
 * @property {string} template
 */
/**
 * @typedef {Object} ReaderFileContentItem
 * @property {number} cursor
 * @property {string} title
 */
/**
 * @typedef {Object} ReaderFileBookmarkItem
 * @property {number} cursor
 * @property {string} title
 * @property {Date} createTime
 */

/** @type {Promise<IDBDatabase>} */
const dbPromise = (function () {
  return new Promise(resolve => {
    const dbOpen = indexedDB.open('reader');
    dbOpen.addEventListener('success', event => {
      resolve(dbOpen.result);
    });
    dbOpen.addEventListener('upgradeneeded', event => {
      const db = dbOpen.result;
      db.createObjectStore('content');
      db.createObjectStore('index', { keyPath: 'id' });
      db.createObjectStore('config');
      db.createObjectStore('list', { keyPath: 'id', autoIncrement: true });
    });
    dbOpen.addEventListener('error', event => {
      alert(i18n.getMessage('storageOpenFail'));
      resolve(null);
    });
  });
}());

dbPromise.then(db => {
  if (!db) return;
  window.addEventListener('beforeunload', () => {
    db.close();
  });
});

const files = {};

storage.files = files;

/**
 * @param {ReaderFile} file
 * @returns {Promise<IDBValidKey>}
 */
files.add = function (meta, content) {
  return new Promise(async (resolve, reject) => {
    const db = await dbPromise;
    if (!db) reject();
    const transaction = db.transaction(['content', 'list', 'index'], 'readwrite');
    const addFile = transaction.objectStore('list').add(meta);
    addFile.addEventListener('success', event => {
      const id = meta.id = addFile.result;
      const addContent = transaction.objectStore('content').add(content, id);
      addContent.addEventListener('success', event => {
        const addIndex = transaction.objectStore('index').add({ id });
        addIndex.addEventListener('success', event => { resolve(meta); });
        addIndex.addEventListener('error', event => { reject(addIndex.error); });
      });
      addContent.addEventListener('error', event => { reject(addContent.error); });
    });
    addFile.addEventListener('error', event => { reject(addFile.error); });
  });
};

/**
 * @param {IDBValidKey} id
 * @returns {Promise<void>}
 */
files.remove = function (id) {
  return new Promise(async (resolve, reject) => {
    const db = await dbPromise;
    if (!db) reject();
    const transaction = db.transaction(['content', 'list', 'index'], 'readwrite');
    const deleteFile = transaction.objectStore('list').delete(id);
    deleteFile.addEventListener('success', event => {
      const deleteContent = transaction.objectStore('content').delete(id);
      deleteContent.addEventListener('success', event => {
        const deleteIndex = transaction.objectStore('index').delete(id);
        deleteIndex.addEventListener('success', event => { resolve(); });
        deleteIndex.addEventListener('error', event => { reject(); });
      });
      deleteContent.addEventListener('error', event => { reject(); });
    });
    deleteFile.addEventListener('error', event => { reject(); });
  });
};

const common = function (type, actionType) {
  const action = {
    get: (store, id) => store.get(id),
    put: (store, ...param) => store.put(...param),
    getAll: store => store.getAll(),
  }[actionType];
  const mode = { put: 'readwrite' }[actionType] ?? 'readonly';
  return async function (...param) {
    return new Promise(async (resolve, reject) => {
      const db = await dbPromise;
      if (!db) reject();
      const transaction = db.transaction([type], mode);
      const store = transaction.objectStore(type);
      const request = action(store, ...param);
      request.onsuccess = function (event) {
        resolve(request.result);
      };
      request.onerror = function () {
        reject(request.error);
      };
    });
  };
};

/** @type {() => Promise<ReaderFileMeta[]>} */
files.list = common('list', 'getAll');
/** @type {(id: IDBValidKey) => Promise<string>} */
files.getContent = common('content', 'get');
/** @type {(id: IDBValidKey) => Promise<ReaderFileMeta>} */
files.getMeta = common('list', 'get');
/** @type {(id: IDBValidKey, meta: ReaderFileMeta) => Promise<string>} */
files.setMeta = common('list', 'put');
/** @type {(id: IDBValidKey) => Promise<ReaderFileIndex>} */
files.getIndex = common('index', 'get');
/** @type {(id: IDBValidKey, meta: ReaderFileIndex) => Promise<string>} */
files.setIndex = common('index', 'put');

const config = {};

storage.config = config;


config.getItem = common('config', 'get');
config.setItem = common('config', 'put');

