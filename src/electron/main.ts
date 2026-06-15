import { app, BrowserWindow, shell, session, ipcMain, nativeTheme } from 'electron';
import { join } from 'path';
import { IS_DEV, DEV_SERVER_URL, APP_INDEX_URL, APP_ORIGIN } from './constants';
import { registerAppSchemeAsPrivileged, handleAppScheme } from './protocol';
import { createWindowStateManager } from './windowState';
import { createTray } from './tray';
import { registerDeepLinks, flushPendingDeepLinks } from './deepLink';

registerAppSchemeAsPrivileged();

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

const getWindow = () => mainWindow;
const quit = () => {
  isQuitting = true;
  app.quit();
};

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


  const isOurs = (url: string) => url.startsWith(APP_ORIGIN) || (IS_DEV && url.startsWith(DEV_SERVER_URL));

  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
    callback(isOurs(wc?.getURL() || '') && ALLOWED.has(permission));
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission, origin) => {
    return isOurs(origin) && ALLOWED.has(permission);
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

  // open external links (http/https not on our origin) in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_ORIGIN) && !(IS_DEV && url.startsWith(DEV_SERVER_URL))) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(APP_ORIGIN) && !(IS_DEV && url.startsWith(DEV_SERVER_URL))) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

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
