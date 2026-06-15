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
  isChat: !!context.isChat,
  platform: process.platform,
  // machine-derived device model + system version (tdesktop-style), computed
  // async in the main process; fed into MTProto initConnection so active
  // sessions read nicely. resolved before ENVIRONMENT is shipped to the worker.
  getDeviceInfo(): Promise<{ deviceModel: string, systemVersion: string }> {
    return ipcRenderer.invoke('get-device-info');
  },
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
  // macOS trackpad two-finger swipe phase (gestureScrollBegin/End), forwarded
  // from the main process to bracket the wheel deltas of a single gesture —
  // drives swipe-to-reply. returns an unsubscribe fn.
  onSwipeGesture(callback: (phase: 'begin' | 'end') => void) {
    const listener = (_event: unknown, phase: 'begin' | 'end') => callback(phase);
    ipcRenderer.on('swipe-gesture', listener);
    return () => ipcRenderer.off('swipe-gesture', listener);
  },
  // subtle trackpad haptic, fired when the swipe-to-reply gesture arms.
  performHaptic() {
    ipcRenderer.send('haptic');
  },
};

export type ElectronAPI = typeof api;

contextBridge.exposeInMainWorld('electronAPI', api);
