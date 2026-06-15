import { app, BrowserWindow } from 'electron';
import { DEEP_LINK_PROTOCOL } from './constants';

// URLs that arrived before the renderer signalled readiness
const pending: string[] = [];
let ready = false;
let getWindow: () => BrowserWindow | null = () => null;

function isDeepLink(arg: string) {
  return arg.startsWith(`${DEEP_LINK_PROTOCOL}://`) || arg.startsWith(`${DEEP_LINK_PROTOCOL}:`);
}

function dispatch(url: string) {
  const win = getWindow();
  if (ready && win) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    win.webContents.send('deep-link', url);
  } else {
    pending.push(url);
  }
}

function dispatchFromArgv(argv: string[]) {
  for (const arg of argv) {
    if (isDeepLink(arg)) dispatch(arg);
  }
}

export function registerDeepLinks(win: () => BrowserWindow | null) {
  getWindow = win;

  if (process.defaultApp && process.argv.length >= 2) {
    // dev: `electron . tg://...` — register with the script path so the OS
    // re-launches us correctly
    app.setAsDefaultProtocolClient(DEEP_LINK_PROTOCOL, process.execPath, [process.argv[1]]);
  } else {
    app.setAsDefaultProtocolClient(DEEP_LINK_PROTOCOL);
  }

  // macOS delivers the link via this event
  app.on('open-url', (event, url) => {
    event.preventDefault();
    dispatch(url);
  });

  // win/linux: a second launch hands its argv to the primary instance
  app.on('second-instance', (_event, argv) => {
    dispatchFromArgv(argv);
  });

  // first launch on win/linux (cold start with a link)
  dispatchFromArgv(process.argv.slice(1));
}

// called from main once the renderer reports the deep-link listener is attached
export function flushPendingDeepLinks() {
  ready = true;
  const win = getWindow();
  if (!win) return;
  while (pending.length) {
    win.webContents.send('deep-link', pending.shift());
  }
}
