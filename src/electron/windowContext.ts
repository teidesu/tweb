import { ipcMain, WebContents, IpcMainEvent } from 'electron';

// per-window context handed to the renderer at preload time. keyed by
// WebContents (not process / not URL) so it survives reloads and in-app
// navigation, and is immune to renderer-process sharing between same-origin
// windows. extend this as new window kinds are added.
export interface WindowContext {
  isChat?: boolean;
}

const contexts = new WeakMap<WebContents, WindowContext>();

export function setWindowContext(wc: WebContents, ctx: WindowContext) {
  contexts.set(wc, ctx);
}

// preload calls this synchronously before any page script runs; the handler
// resolves the requesting window's context (or {} for the main window).
export function registerWindowContextIpc() {
  ipcMain.on('get-window-context', (event: IpcMainEvent) => {
    event.returnValue = contexts.get(event.sender) ?? {};
  });
}
