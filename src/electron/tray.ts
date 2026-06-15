import { app, Tray, Menu, nativeImage, BrowserWindow } from 'electron';
import { join } from 'path';
import { IS_DEV, DIST_DIR } from './constants';

// dev: assets live in public/; prod: copied into dist/
const ASSETS = IS_DEV ? join(app.getAppPath(), 'public', 'assets', 'img') : join(DIST_DIR, 'assets', 'img');

let tray: Tray | null = null;

export function createTray(getWindow: () => BrowserWindow | null, quit: () => void) {
  if (tray) return tray;

  // macOS menu bar wants a monochrome template silhouette sized in points
  // (16pt, @2x auto-picked); elsewhere the colored 16px favicon is correct.
  const isMac = process.platform === 'darwin';
  const icon = nativeImage.createFromPath(join(ASSETS, isMac ? 'trayTemplate.png' : 'favicon-16x16.png'));
  if (isMac) icon.setTemplateImage(true);

  tray = new Tray(icon);
  tray.setToolTip('Telegram');

  const show = () => {
    const win = getWindow();
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  };

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Telegram', click: show },
    { type: 'separator' },
    { label: 'Quit', click: quit },
  ]));

  tray.on('click', show);
  return tray;
}
