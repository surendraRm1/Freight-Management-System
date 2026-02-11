const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('freightDesktop', {
  env: process.env.NODE_ENV || 'production',
  apiBase: process.env.FREIGHT_DESKTOP_API_BASE || null,
  getApiBase: () => ipcRenderer.invoke('freight:get-api-base'),
});
