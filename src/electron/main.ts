import { app, BrowserWindow, shell, session, ipcMain, nativeTheme } from 'electron';
import type { WebContents, BrowserWindowConstructorOptions } from 'electron';
import { join } from 'path';
import { IS_DEV, DEV_SERVER_URL, APP_INDEX_URL, APP_ORIGIN } from './constants';
import { registerAppSchemeAsPrivileged, handleAppScheme } from './protocol';
import { createWindowStateManager } from './windowState';
import { createTray } from './tray';
import { registerDeepLinks, flushPendingDeepLinks } from './deepLink';
import { registerWindowContextIpc, setWindowContext } from './windowContext';

registerAppSchemeAsPrivileged();
registerWindowContextIpc();

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

const getWindow = () => mainWindow;
const quit = () => {
  isQuitting = true;
  app.quit();
};

const isInternalUrl = (url: string) =>
  url.startsWith(APP_ORIGIN) || (IS_DEV && url.startsWith(DEV_SERVER_URL));

// "Open in new window" builds a #/im?p=... hash route; only those spawn a
// standalone chat window. anything else internal is denied so a stray/forged
// window.open can't open arbitrary app routes as a chrome-less window.
const isChatUrl = (url: string) => {
  try {
    return /^#\/im(?:[?/]|$)/.test(new URL(url).hash);
  } catch {
    return false;
  }
};

const chatWindowOptions = (): BrowserWindowConstructorOptions => ({
  width: 610,
  height: 800,
  minWidth: 380,
  minHeight: 480,
  autoHideMenuBar: true,
  backgroundColor: nativeTheme.shouldUseDarkColors ? '#212121' : '#ffffff',
  webPreferences: {
    preload: join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false,
    // eagerly persist v8 bytecode so additional windows reuse it (shared session cache)
    v8CacheOptions: 'bypassHeatCheck',
  },
});

// applied to the main window and every window it spawns: external links go to
// the system browser, in-app navigation is pinned to our origin, <webview>
// embedding is blocked, and child windows are tagged + guarded recursively.
function applyNavigationGuards(contents: WebContents) {
  contents.setWindowOpenHandler(({ url }) => {
    if (!isInternalUrl(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    if (!isChatUrl(url)) return { action: 'deny' };
    return { action: 'allow', overrideBrowserWindowOptions: chatWindowOptions() };
  });

  contents.on('did-create-window', (win, { url }) => {
    setWindowContext(win.webContents, { isChat: isChatUrl(url) });
    applyNavigationGuards(win.webContents);
  });

  contents.on('will-navigate', (event, url) => {
    if (!isInternalUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // we never embed remote content
  contents.on('will-attach-webview', (event) => event.preventDefault());
}

// single-instance: a second launch focuses the existing window (and forwards
// deep links via the 'second-instance' handler in deepLink.ts)
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  registerDeepLinks(getWindow);

  app.whenReady().then(() => {
    if (!IS_DEV) handleAppScheme();
    setupPermissions();
    createWindow();

    app.on('activate', () => {
      if (mainWindow) {
        mainWindow.show();
      } else {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    // keep running in the tray; only a real quit closes the app
    if (process.platform !== 'darwin' && isQuitting) app.quit();
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });
}

function setupPermissions() {
  const ALLOWED = new Set([
    'notifications',
    'media',
    'clipboard-read',
    'clipboard-sanitized-write',
    'fullscreen',
    'pointerLock',
  ]);


  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
    callback(isInternalUrl(wc?.getURL() || '') && ALLOWED.has(permission));
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission, origin) => {
    return isInternalUrl(origin) && ALLOWED.has(permission);
  });
}

function createWindow() {
  const windowState = createWindowStateManager();

  mainWindow = new BrowserWindow({
    ...windowState.bounds,
    minWidth: 400,
    minHeight: 600,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#212121' : '#ffffff',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: true,
      v8CacheOptions: 'bypassHeatCheck',
    },
  });

  windowState.track(mainWindow);
  if (windowState.maximized) mainWindow.maximize();

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // hide to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  applyNavigationGuards(mainWindow.webContents);

  createTray(getWindow, quit);

  if (IS_DEV) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadURL(APP_INDEX_URL);
  }
}

// renderer signals its deep-link listener is ready
ipcMain.on('renderer-ready', () => flushPendingDeepLinks());

// a standalone chat window asks to open a peer in the main window.
ipcMain.on('open-in-main-window', (_event, payload) => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('open-peer', payload);
});
