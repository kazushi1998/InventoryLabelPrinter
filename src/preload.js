const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("labelPrinter", {
  getState: () => ipcRenderer.invoke("state:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  saveFormat: (format) => ipcRenderer.invoke("format:save", format),
  addFormat: (format) => ipcRenderer.invoke("format:add", format),
  deleteFormat: (formatId) => ipcRenderer.invoke("format:delete", formatId),
  createBatch: (payload) => ipcRenderer.invoke("batch:create", payload),
  getBatch: (batchId) => ipcRenderer.invoke("batch:get", batchId),
  clearBatches: () => ipcRenderer.invoke("batches:clear"),
  printLabels: (batch, labels, settings) => ipcRenderer.invoke("print:labels", batch, labels, settings)
});
