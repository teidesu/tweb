import type { ElectronAPI } from '@/electron/preload';

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export const electronAPI = window.electronAPI;
export const IS_ELECTRON = !!electronAPI;

let initialized = false;

// wire native deep links (tg://...) into the app's existing url handler
export function initElectronIntegration() {
  if (initialized || !electronAPI) return;
  initialized = true;

  electronAPI.onDeepLink(async(url) => {
    const { default: appImManager } = await import('@lib/appImManager');
    appImManager.openUrl(url);
  });
}
