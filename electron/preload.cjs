const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lumina', {
  chooseFolder: () => ipcRenderer.invoke('folder:choose'),
  getChildren: (directoryPath) => ipcRenderer.invoke('folder:children', directoryPath),
  getMedia: (directoryPath, recursive) => ipcRenderer.invoke('folder:media', directoryPath, recursive),
  prepareMedia: (items, requestId) => ipcRenderer.invoke('folder:prepare', items, requestId),
  getItemInfo: (itemPath) => ipcRenderer.invoke('item:info', itemPath),
  moveToTrash: (itemPath) => ipcRenderer.invoke('item:trash', itemPath),
  revealItem: (itemPath) => ipcRenderer.invoke('item:reveal', itemPath),
  openItem: (itemPath) => ipcRenderer.invoke('item:open-default', itemPath),
  moveItem: (itemPath, destinationPath, viewDirectoryPath) => ipcRenderer.invoke('item:move', itemPath, destinationPath, viewDirectoryPath),
  renameItem: (itemPath, newName) => ipcRenderer.invoke('item:rename', itemPath, newName),
  createFolder: (directoryPath, folderName) => ipcRenderer.invoke('folder:create', directoryPath, folderName),
  readTextFile: (itemPath) => ipcRenderer.invoke('text:read', itemPath),
  writeTextFile: (itemPath, content) => ipcRenderer.invoke('text:write', itemPath, content),
  startExternalDrag: (itemPath) => ipcRenderer.send('item:start-external-drag', itemPath),
  onExternalDragEnded: (callback) => {
    const listener = (_event, result) => callback(result);
    ipcRenderer.on('item:external-drag-ended', listener);
    return () => ipcRenderer.removeListener('item:external-drag-ended', listener);
  },
  onFilesystemChanged: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('filesystem:changed', listener);
    return () => ipcRenderer.removeListener('filesystem:changed', listener);
  },
  onPrepareProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('folder:prepare-progress', listener);
    return () => ipcRenderer.removeListener('folder:prepare-progress', listener);
  }
});
