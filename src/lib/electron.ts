import type { ChatType } from '@components/chat/chatType';

// Standalone single-chat window ("Open in new window")
export const IS_ELECTRON_CHAT = __IS_ELECTRON_BUILD__ && !!electronAPI?.isChat;

if (IS_ELECTRON_CHAT) {
  document.documentElement.classList.add('no-left-sidebar');
}

let initialized = false;

// wire native deep links (tg://...) into the app's existing url handler
export function initElectronIntegration() {
  if (!__IS_ELECTRON_BUILD__ || initialized || !electronAPI) return;
  initialized = true;

  electronAPI.onDeepLink(async(url) => {
    const { default: appImManager } = await import('@lib/appImManager');
    appImManager.openUrl(url);
  });

  // peers forwarded from standalone chat windows open here, in the main window
  if (!IS_ELECTRON_CHAT) {
    electronAPI.onOpenPeer(async(payload) => {
      const { default: appImManager } = await import('@lib/appImManager');
      appImManager.setInnerPeer({
        ...payload,
        type: payload.type as ChatType,
      });
    });
  }
}
