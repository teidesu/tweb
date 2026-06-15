import { app } from 'electron';
import { join } from 'path';

export const IS_DEV = !app.isPackaged;

// dev: vite dev server (hybrid mode); prod: bundled dist/ via custom scheme
export const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL || 'http://localhost:8080';

// custom privileged scheme — gives bundled dist/ a secure context so the
// ServiceWorker + SharedWorker the app relies on can register (file:// can't).
export const APP_SCHEME = 'tweb';
export const APP_HOST = 'app';
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
export const APP_INDEX_URL = `${APP_ORIGIN}/index.html`;

// protocol to register as default handler for deep links
export const DEEP_LINK_PROTOCOL = 'tg';

// renderer bundle inside the packaged app
export const DIST_DIR = join(app.getAppPath(), 'dist');
