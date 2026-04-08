import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  readFiles: (filePaths) => ipcRenderer.invoke('read-files', filePaths),
  writeFile: (filePath, base64Data) => ipcRenderer.invoke('write-file', filePath, base64Data),
  downloadUrlFile: (url, suggestedName) => ipcRenderer.invoke('download-url-file', url, suggestedName),
});
