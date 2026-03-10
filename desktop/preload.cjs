const { contextBridge } = require('electron');
const keytar = require('keytar');

const SERVICE = 'qdk-mail';

contextBridge.exposeInMainWorld('electronAPI', {
  secureStore: {
    async get(name) {
      return await keytar.getPassword(SERVICE, name);
    },
    async set(name, value) {
      if (value === null || value === undefined) {
        await keytar.deletePassword(SERVICE, name);
        return true;
      }
      await keytar.setPassword(SERVICE, name, String(value));
      return true;
    },
    async delete(name) {
      return await keytar.deletePassword(SERVICE, name);
    },
  },
});

