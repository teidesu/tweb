import { contextBridge, ipcRenderer } from 'electron';
import type { WindowContext } from './windowContext';

// peer navigation forwarded from a standalone chat window to the main window
// (it must never swap its own active chat). primitives only — survives IPC
// structured clone; the renderer maps `type` back to its ChatType enum.
export interface OpenPeerPayload {
  peerId: number;
  threadId?: number;
  lastMsgId?: number;
  commentId?: number;
  mediaTimestamp?: number;
  startParam?: string;
  type?: string;
}

// the per-window context is fetched synchronously here (pre-paint, before any
// page script) and is keyed by webContents in the main process, so it survives
// reloads / in-app navigation and never leaks between same-origin windows that
// share a renderer process.
const context: WindowContext = ipcRenderer.sendSync('get-window-context') ?? {};

const api = {
  isElectron: true,
  isChat: !!context.isChat,
  platform: process.platform,
  // subscribe to deep links (tg://...) forwarded from the main process.
  // returns an unsubscribe fn; signals readiness so buffered links flush.
  onDeepLink(callback: (url: string) => void) {
    const listener = (_event: unknown, url: string) => callback(url);
    ipcRenderer.on('deep-link', listener);
    ipcRenderer.send('renderer-ready');
    return () => ipcRenderer.off('deep-link', listener);
  },
  // chat window → main window: open this peer in the main window instead of
  // replacing the chat window's own chat.
  openInMainWindow(payload: OpenPeerPayload) {
    ipcRenderer.send('open-in-main-window', payload);
  },
  // main window: receive peers forwarded from chat windows.
  onOpenPeer(callback: (payload: OpenPeerPayload) => void) {
    const listener = (_event: unknown, payload: OpenPeerPayload) => callback(payload);
    ipcRenderer.on('open-peer', listener);
    return () => ipcRenderer.off('open-peer', listener);
  },
};

export type ElectronAPI = typeof api;

contextBridge.exposeInMainWorld('electronAPI', api);
