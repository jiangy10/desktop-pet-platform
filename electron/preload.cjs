const { contextBridge, ipcRenderer } = require("electron");

const on = (channel) => (cb) => {
  const handler = () => cb();
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

contextBridge.exposeInMainWorld("petApi", {
  listPresets: () => ipcRenderer.invoke("presets:list"),
  getActive: () => ipcRenderer.invoke("presets:getActive"),
  setActive: (id) => ipcRenderer.invoke("presets:setActive", id),
  loadPreset: (id) => ipcRenderer.invoke("presets:load", id),
  savePreset: (preset) => ipcRenderer.invoke("presets:save", preset),
  createPreset: (name) => ipcRenderer.invoke("presets:create", name),
  deletePreset: (id) => ipcRenderer.invoke("presets:delete", id),
  importAsset: (presetId, fileName, bytes) => ipcRenderer.invoke("assets:import", presetId, fileName, bytes),
  onPresetChanged: on("pet:reload"),
  onPresetListChanged: on("presets:changed"),
});
