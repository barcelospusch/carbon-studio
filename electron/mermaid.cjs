'use strict';
const fs = require('node:fs/promises');
const {BrowserWindow, session} = require('electron');

let isolatedSession;

function mermaidRenderer(url, serveApp) {
  let window;
  return {
    async render(source, output, {signal, timeout}) {
      if (signal?.aborted) throw new Error('Compilação cancelada.');
      if (!isolatedSession) {
        isolatedSession = session.fromPartition('carbon-mermaid');
        isolatedSession.protocol.handle('carbon-studio', serveApp);
        isolatedSession.webRequest.onBeforeRequest(({url: request}, callback) => {
          const allowed = request.startsWith('carbon-studio://app/') || request.startsWith('http://127.0.0.1:5173/');
          callback({cancel: !allowed && !/^(blob:|data:)/.test(request)});
        });
        isolatedSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
      }
      if (!window) {
        window = new BrowserWindow({
          show:false,
          webPreferences:{session:isolatedSession, sandbox:true, contextIsolation:true, nodeIntegration:false, backgroundThrottling:false},
        });
        window.webContents.setWindowOpenHandler(() => ({action:'deny'}));
        window.webContents.on('will-navigate', event => event.preventDefault());
      }
      const abort = () => { if (!window.isDestroyed()) window.destroy(); };
      signal?.addEventListener('abort', abort, {once:true});
      const timer = setTimeout(abort, Math.min(timeout || 30000, 30000));
      try {
        if (!window.webContents.getURL()) await window.loadURL(url);
        const png = await window.webContents.executeJavaScript('window.renderCarbonDiagram(' + JSON.stringify(source) + ')');
        await fs.writeFile(output, Buffer.from(png, 'base64'));
      } catch (error) {
        if (signal?.aborted) throw new Error('Compilação cancelada.');
        if (window.isDestroyed()) throw new Error('Tempo limite ao renderizar Mermaid.');
        throw error;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
      }
    },
    close() { if (window && !window.isDestroyed()) window.destroy(); },
  };
}

module.exports = {mermaidRenderer};
