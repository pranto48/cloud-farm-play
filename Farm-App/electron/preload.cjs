const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  isDesktop: true,
  listSaves: () => ipcRenderer.invoke('saves:list'),
  saveGame: (saveData) => ipcRenderer.invoke('saves:save', saveData),
  loadGame: (slotId) => ipcRenderer.invoke('saves:load', slotId),
  deleteSave: (slotId) => ipcRenderer.invoke('saves:delete', slotId),
  openSavesFolder: () => ipcRenderer.invoke('saves:openFolder'),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
  getAppInfo: () => ipcRenderer.invoke('app:getInfo'),
});
