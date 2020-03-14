import storage from './storage.js';

const config = {};

export default config;

const listenerList = [];

config.get = async name => {
  let value = await storage.config.getItem(name);
  return value;
};

config.set = async (name, value) => {
  await storage.config.setItem(value, name);
  Promise.resolve().then(() => {
    listenerList.forEach(i => {
      if (i.name === name) i.listener(value);
    });
  });
  return value;
};

const findListener = (name, listener) => {
  return listenerList.findIndex(i => i.name === name && i.listener === listener);
};

config.addListener = (name, listener) => {
  const pos = findListener(name, listener);
  if (pos === -1) listenerList.push({ name, listener });
};

config.removeListener = (name, listener) => {
  const pos = findListener(name, listener);
  if (pos !== -1) listenerList.splice(pos, 1);
};

