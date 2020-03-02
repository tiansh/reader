import storage from './storage.js';

const config = {};

export default config;

config.get = async name => {
  let value = await storage.config.getItem(name);
  return value;
};

config.set = async (name, value) => {
  await storage.config.setItem(value, name);
  return value;
};

