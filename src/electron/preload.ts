import { contextBridge, ipcRenderer } from 'electron';

const api = {
  isElectron: true,
  platform: process.platform,
  // subscribe to deep links (tg://...) forwarded from the main process.
  // returns an unsubscribe fn; signals readiness so buffered links flush.
  onDeepLink(callback: (url: string) => void) {
    const listener = (_event: unknown, url: string) => callback(url);
    ipcRenderer.on('deep-link', listener);
    ipcRenderer.send('renderer-ready');
    return () => ipcRenderer.off('deep-link', listener);
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
