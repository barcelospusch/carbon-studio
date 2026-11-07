'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const invoke = (name, payload) => ipcRenderer.invoke(name, payload);
contextBridge.exposeInMainWorld('carbonStudio', {
  bootstrap: () => invoke('studio:bootstrap'),
  newDocument: () => invoke('studio:new'),
  openDocument: () => invoke('studio:open'),
  selectDocument: relative=>invoke('studio:select-document',relative),
  refreshProject: ()=>invoke('studio:refresh-project'),
  saveDocument: saveAs => invoke('studio:save', { saveAs: !!saveAs }),
  updateText: text => ipcRenderer.send('studio:edit', text),
  compile: () => invoke('studio:compile'),
  cancelCompile: () => invoke('studio:cancel'),
  exportPdf: () => invoke('studio:export'),
  chooseImage: () => invoke('studio:image'),
  getSettings: () => invoke('studio:settings'),
  getThemes: ()=>invoke('studio:themes'),
  openRepository: ()=>invoke('studio:repository'),
  openThemesFolder: ()=>invoke('studio:themes-folder'),
  getLayout: source => invoke('studio:layout', source),
  applyLayout: (source, layout) => invoke('studio:layout-apply', {source, layout}),
  alignText: (source, selection, target, mode) => invoke('studio:alignment', {source,selection,target,mode}),
  saveSettings: settings => invoke('studio:settings-save', settings),
  chooseTool: () => invoke('studio:choose-tool'),
  onEvent: callback => { const listener = (_event, data) => callback(data); ipcRenderer.on('studio:event', listener); return () => ipcRenderer.removeListener('studio:event', listener); },
});
