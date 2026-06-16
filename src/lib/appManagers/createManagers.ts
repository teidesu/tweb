import { PasswordManager } from '@/lib/appManagers/passwordManager';
import { ReferencesStorage } from '@/lib/storages/references';
import DialogsStorage from '@/lib/storages/dialogs';
import FiltersStorage from '@/lib/storages/filters';
import { ApiUpdatesManager } from '@/lib/appManagers/apiUpdatesManager';
import { AppAvatarsManager } from '@/lib/appManagers/appAvatarsManager';
import { AppCallsManager } from '@/lib/appManagers/appCallsManager';
import { AppChatsManager } from '@/lib/appManagers/appChatsManager';
import { AppDocsManager } from '@/lib/appManagers/appDocsManager';
import { AppDraftsManager } from '@/lib/appManagers/appDraftsManager';
import { AppEmojiManager } from '@/lib/appManagers/appEmojiManager';
import { AppGroupCallsManager } from '@/lib/appManagers/appGroupCallsManager';
import { AppInlineBotsManager } from '@/lib/appManagers/appInlineBotsManager';
import { AppMessagesIdsManager } from '@/lib/appManagers/appMessagesIdsManager';
import { AppMessagesManager } from '@/lib/appManagers/appMessagesManager';
import { AppNotificationsManager } from '@/lib/appManagers/appNotificationsManager';
import { AppPeersManager } from '@/lib/appManagers/appPeersManager';
import { AppPhotosManager } from '@/lib/appManagers/appPhotosManager';
import { AppPollsManager } from '@/lib/appManagers/appPollsManager';
import { AppPrivacyManager } from '@/lib/appManagers/appPrivacyManager';
import { AppProfileManager } from '@/lib/appManagers/appProfileManager';
import { AppReactionsManager } from '@/lib/appManagers/appReactionsManager';
import { AppStickersManager } from '@/lib/appManagers/appStickersManager';
import { AppUsersManager } from '@/lib/appManagers/appUsersManager';
import { AppWebPagesManager } from '@/lib/appManagers/appWebPagesManager';
import { AppLangPackManager } from '@/lib/appManagers/appLangPackManager';
import { ApiFileManager } from '@/lib/appManagers/apiFileManager';
import { ApiManager } from '@/lib/appManagers/apiManager';
import ctx from '@/environment/ctx';
import PeersStorage from '@/lib/storages/peers';
import ThumbsStorage from '@/lib/storages/thumbs';
import { NetworkerFactory } from '@/lib/appManagers/networkerFactory';
import rootScope, { RootScope } from '@/lib/rootScope';
import { Authorizer } from '@/lib/mtproto/authorizer';
import { DcConfigurator } from '@/lib/mtproto/dcConfigurator';
import { TimeManager } from '@/lib/mtproto/timeManager';
import { AppStoragesManager } from '@/lib/appManagers/appStoragesManager';
import cryptoMessagePort from '@/lib/crypto/cryptoMessagePort';
import AppStateManager from '@/lib/appManagers/appStateManager';
import filterUnique from '@/helpers/array/filterUnique';
import AppWebDocsManager from '@/lib/appManagers/appWebDocsManager';
import AppPaymentsManager from '@/lib/appManagers/appPaymentsManager';
import AppAttachMenuBotsManager from '@/lib/appManagers/appAttachMenuBotsManager';
import AppSeamlessLoginManager from '@/lib/appManagers/appSeamlessLoginManager';
import AppThemesManager from '@/lib/appManagers/appThemesManager';
import AppUsernamesManager from '@/lib/appManagers/appUsernamesManager';
import AppChatInvitesManager from '@/lib/appManagers/appChatInvitesManager';
import AppStoriesManager from '@/lib/appManagers/appStoriesManager';
import AppBotsManager from '@/lib/appManagers/appBotsManager';
import AppBoostsManager from '@/lib/appManagers/appBoostsManager';
import AppStatisticsManager from '@/lib/appManagers/appStatisticsManager';
import AppBusinessManager from '@/lib/appManagers/appBusinessManager';
import AppTranslationsManager from '@/lib/appManagers/appTranslationsManager';
import AppGifsManager from '@/lib/appManagers/appGifsManager';
import { ActiveAccountNumber } from '@/lib/accounts/types';
import { AppManager } from '@/lib/appManagers/manager';
import AppGiftsManager from '@/lib/appManagers/appGiftsManager';
import AppGamesManager from '@/lib/appManagers/appGamesManager';
import MonoforumDialogsStorage from '@/lib/storages/monoforumDialogs';
import MessagesPersistentStorage from '@/lib/storages/messagesPersistent';
import AppPromoManager from '@/lib/appManagers/appPromoManager';
import AppAccountManager from '@/lib/appManagers/appAccountManager';

export default function createManagers(
  appStoragesManager: AppStoragesManager,
  stateManager: AppStateManager,
  accountNumber: ActiveAccountNumber,
  userId: UserId
) {
  const managers = {
    appPeersManager: new AppPeersManager,
    appChatsManager: new AppChatsManager,
    appDocsManager: new AppDocsManager,
    appPhotosManager: new AppPhotosManager,
    appPollsManager: new AppPollsManager,
    appUsersManager: new AppUsersManager,
    appWebPagesManager: new AppWebPagesManager,
    appDraftsManager: new AppDraftsManager,
    appProfileManager: new AppProfileManager,
    appNotificationsManager: new AppNotificationsManager,
    apiUpdatesManager: new ApiUpdatesManager,
    appAvatarsManager: new AppAvatarsManager,
    appGroupCallsManager: new AppGroupCallsManager,
    appCallsManager: new AppCallsManager,
    appReactionsManager: new AppReactionsManager,
    appMessagesManager: new AppMessagesManager,
    appMessagesIdsManager: new AppMessagesIdsManager,
    appPrivacyManager: new AppPrivacyManager,
    appInlineBotsManager: new AppInlineBotsManager,
    appStickersManager: new AppStickersManager,
    appLangPackManager: new AppLangPackManager,
    referencesStorage: new ReferencesStorage,
    appEmojiManager: new AppEmojiManager,
    filtersStorage: new FiltersStorage,
    dialogsStorage: new DialogsStorage,
    apiManager: new ApiManager,
    cryptoWorker: cryptoMessagePort,
    passwordManager: new PasswordManager,
    apiFileManager: new ApiFileManager,
    peersStorage: new PeersStorage,
    thumbsStorage: new ThumbsStorage,
    networkerFactory: new NetworkerFactory,
    rootScope: new RootScope,
    authorizer: undefined as unknown as Authorizer,
    dcConfigurator: new DcConfigurator,
    timeManager: new TimeManager,
    appStoragesManager: appStoragesManager,
    appStateManager: stateManager,
    appWebDocsManager: new AppWebDocsManager,
    appPaymentsManager: new AppPaymentsManager,
    appAttachMenuBotsManager: new AppAttachMenuBotsManager,
    appSeamlessLoginManager: new AppSeamlessLoginManager,
    appThemesManager: new AppThemesManager,
    appUsernamesManager: new AppUsernamesManager,
    appChatInvitesManager: new AppChatInvitesManager,
    appStoriesManager: new AppStoriesManager,
    appBotsManager: new AppBotsManager,
    appBoostsManager: new AppBoostsManager,
    appStatisticsManager: new AppStatisticsManager,
    appBusinessManager: new AppBusinessManager,
    appTranslationsManager: new AppTranslationsManager,
    appGifsManager: new AppGifsManager,
    appGiftsManager: new AppGiftsManager,
    appGamesManager: new AppGamesManager,
    monoforumDialogsStorage: new MonoforumDialogsStorage,
    messagesPersistentStorage: new MessagesPersistentStorage,
    appPromoManager: new AppPromoManager,
    appAccountManager: new AppAccountManager,
  };

  managers.authorizer = new Authorizer({
    timeManager: managers.timeManager,
    dcConfigurator: managers.dcConfigurator,
  });

  type T = typeof managers;

  for (const name in managers) {
    const manager = managers[name as keyof T] as AppManager;
    if (!manager) {
      continue;
    }

    if (manager.setManagersAndAccountNumber) {
      manager.setManagersAndAccountNumber(managers as any, accountNumber);
      delete (manager as any).setManagersAndAccountNumber;
    }

    // @ts-ignore
    ctx[name] = manager;
  }

  Object.assign(managers.rootScope, { managers });

  const promises: Array<Promise<(() => void) | void> | void>[] = [];
  let names = Object.keys(managers) as (keyof T)[];
  names.unshift(
    'appUsersManager',
    'appChatsManager',
    'appNotificationsManager',
    'appMessagesManager',
    'dialogsStorage'
  );
  names = filterUnique(names);
  for (const name of names) {
    const manager = managers[name];
    if ((manager as any)?.after) {
      // console.log('injecting after', name);
      const result = (manager as any).after();
      promises.push(result);

      // if(result instanceof Promise) {
      //   result.then(() => {
      //     console.log('injected after', name);
      //   });
      // }
    }
  }

  if (userId) {
    managers.apiManager.setUserAuth(userId);
  }

  return Promise.all(promises).then(() => {
    managers.rootScope.dispatchEventSingle('managers_ready');
    return managers;
  });
}
