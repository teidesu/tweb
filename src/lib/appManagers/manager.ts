import type { CryptoMessagePort } from '@/lib/crypto/cryptoMessagePort';
import type { ApiFileManager } from '@/lib/appManagers/apiFileManager';
import type { ApiManager } from '@/lib/appManagers/apiManager';
import type { Authorizer } from '@/lib/mtproto/authorizer';
import type { DcConfigurator } from '@/lib/mtproto/dcConfigurator';
import type { NetworkerFactory } from '@/lib/appManagers/networkerFactory';
import type { PasswordManager } from '@/lib/appManagers/passwordManager';
import type { ReferencesStorage } from '@/lib/storages/references';
import type { TimeManager } from '@/lib/mtproto/timeManager';
import type { RootScope } from '@/lib/rootScope';
import type DialogsStorage from '@/lib/storages/dialogs';
import type FiltersStorage from '@/lib/storages/filters';
import type MonoforumDialogsStorage from '@/lib/storages/monoforumDialogs';
import type MessagesPersistentStorage from '@/lib/storages/messagesPersistent';
import type PeersStorage from '@/lib/storages/peers';
import type ThumbsStorage from '@/lib/storages/thumbs';
import type { ApiUpdatesManager } from '@/lib/appManagers/apiUpdatesManager';
import type { AppAvatarsManager } from '@/lib/appManagers/appAvatarsManager';
import type { AppCallsManager } from '@/lib/appManagers/appCallsManager';
import type { AppChatsManager } from '@/lib/appManagers/appChatsManager';
import type { AppDocsManager } from '@/lib/appManagers/appDocsManager';
import type { AppDraftsManager } from '@/lib/appManagers/appDraftsManager';
import type { AppEmojiManager } from '@/lib/appManagers/appEmojiManager';
import type { AppGroupCallsManager } from '@/lib/appManagers/appGroupCallsManager';
import type { AppInlineBotsManager } from '@/lib/appManagers/appInlineBotsManager';
import type { AppMessagesIdsManager } from '@/lib/appManagers/appMessagesIdsManager';
import type { AppMessagesManager } from '@/lib/appManagers/appMessagesManager';
import type { AppNotificationsManager } from '@/lib/appManagers/appNotificationsManager';
import type AppPaymentsManager from '@/lib/appManagers/appPaymentsManager';
import type { AppPeersManager } from '@/lib/appManagers/appPeersManager';
import type { AppPhotosManager } from '@/lib/appManagers/appPhotosManager';
import type { AppPollsManager } from '@/lib/appManagers/appPollsManager';
import type { AppPrivacyManager } from '@/lib/appManagers/appPrivacyManager';
import type { AppProfileManager } from '@/lib/appManagers/appProfileManager';
import type { AppReactionsManager } from '@/lib/appManagers/appReactionsManager';
import type AppStateManager from '@/lib/appManagers/appStateManager';
import type { AppStickersManager } from '@/lib/appManagers/appStickersManager';
import type { AppStoragesManager } from '@/lib/appManagers/appStoragesManager';
import type { AppUsersManager } from '@/lib/appManagers/appUsersManager';
import type AppWebDocsManager from '@/lib/appManagers/appWebDocsManager';
import type { AppWebPagesManager } from '@/lib/appManagers/appWebPagesManager';
import type AppAttachMenuBotsManager from '@/lib/appManagers/appAttachMenuBotsManager';
import type AppSeamlessLoginManager from '@/lib/appManagers/appSeamlessLoginManager';
import type AppThemesManager from '@/lib/appManagers/appThemesManager';
import type AppUsernamesManager from '@/lib/appManagers/appUsernamesManager';
import type AppChatInvitesManager from '@/lib/appManagers/appChatInvitesManager';
import type AppStoriesManager from '@/lib/appManagers/appStoriesManager';
import type AppBotsManager from '@/lib/appManagers/appBotsManager';
import type AppBoostsManager from '@/lib/appManagers/appBoostsManager';
import type AppStatisticsManager from '@/lib/appManagers/appStatisticsManager';
import type AppBusinessManager from '@/lib/appManagers/appBusinessManager';
import type AppTranslationsManager from '@/lib/appManagers/appTranslationsManager';
import type { AppManagers } from '@/lib/managers';
import type AppGifsManager from '@/lib/appManagers/appGifsManager';
import type AppGiftsManager from '@/lib/appManagers/appGiftsManager';
import type AppGamesManager from '@/lib/appManagers/appGamesManager';
import type { AppLangPackManager } from '@/lib/appManagers/appLangPackManager';
import type { ActiveAccountNumber } from '@/lib/accounts/types';
import type AppPromoManager from '@/lib/appManagers/appPromoManager';
import type AppAccountManager from '@/lib/appManagers/appAccountManager';
import { logger, LogTypes } from '@/lib/logger';

export class AppManager {
  private accountNumber: ActiveAccountNumber;

  protected appPeersManager: AppPeersManager;
  protected appChatsManager: AppChatsManager;
  protected appDocsManager: AppDocsManager;
  protected appPhotosManager: AppPhotosManager;
  protected appPollsManager: AppPollsManager;
  protected appUsersManager: AppUsersManager;
  protected appWebPagesManager: AppWebPagesManager;
  protected appDraftsManager: AppDraftsManager;
  protected appProfileManager: AppProfileManager;
  protected appNotificationsManager: AppNotificationsManager;
  protected apiUpdatesManager: ApiUpdatesManager;
  protected appAvatarsManager: AppAvatarsManager;
  protected appGroupCallsManager: AppGroupCallsManager;
  protected appCallsManager: AppCallsManager;
  protected appReactionsManager: AppReactionsManager;
  protected appMessagesManager: AppMessagesManager;
  protected appMessagesIdsManager: AppMessagesIdsManager;
  protected appPrivacyManager: AppPrivacyManager;
  protected appInlineBotsManager: AppInlineBotsManager;
  protected appStickersManager: AppStickersManager;
  protected appLangPackManager: AppLangPackManager;
  protected referencesStorage: ReferencesStorage;
  protected appEmojiManager: AppEmojiManager;
  protected dialogsStorage: DialogsStorage;
  protected filtersStorage: FiltersStorage;
  protected apiManager: ApiManager;
  // protected apiManager: ApiManagerProxy;
  protected passwordManager: PasswordManager;
  protected cryptoWorker: CryptoMessagePort;
  protected apiFileManager: ApiFileManager;
  protected peersStorage: PeersStorage;
  protected thumbsStorage: ThumbsStorage;
  protected networkerFactory: NetworkerFactory;
  protected rootScope: RootScope;
  protected authorizer: Authorizer;
  protected dcConfigurator: DcConfigurator;
  protected timeManager: TimeManager;
  protected appStoragesManager: AppStoragesManager;
  protected appStateManager: AppStateManager;
  protected appWebDocsManager: AppWebDocsManager;
  protected appPaymentsManager: AppPaymentsManager;
  protected appAttachMenuBotsManager: AppAttachMenuBotsManager;
  protected appSeamlessLoginManager: AppSeamlessLoginManager;
  protected appThemesManager: AppThemesManager;
  protected appUsernamesManager: AppUsernamesManager;
  protected appChatInvitesManager: AppChatInvitesManager;
  protected appStoriesManager: AppStoriesManager;
  protected appBotsManager: AppBotsManager;
  protected appBoostsManager: AppBoostsManager;
  protected appStatisticsManager: AppStatisticsManager;
  protected appBusinessManager: AppBusinessManager;
  protected appTranslationsManager: AppTranslationsManager;
  protected appGifsManager: AppGifsManager;
  protected appGiftsManager: AppGiftsManager;
  protected appGamesManager: AppGamesManager;
  protected monoforumDialogsStorage: MonoforumDialogsStorage;
  protected messagesPersistentStorage: MessagesPersistentStorage;
  protected appPromoManager: AppPromoManager;
  protected appAccountManager: AppAccountManager;

  protected name: string;
  public log: ReturnType<typeof logger>;
  protected logTypes: LogTypes;
  protected logIgnoreDebugReset: boolean;

  public clear: (init?: boolean) => void;

  public getAccountNumber() {
    return this.accountNumber;
  }

  public createLogger(prefix: string, logTypes?: LogTypes, ignoreDebugReset?: boolean) {
    return logger(`ACC-${this.accountNumber}-${prefix}`, logTypes, ignoreDebugReset);
  }

  public setManagersAndAccountNumber(managers: AppManagers, accountNumber: ActiveAccountNumber) {
    Object.assign(this, { ...managers, accountNumber });
    this.name = this.name ?? '';
    this.log = this.createLogger(this.name, this.logTypes, this.logIgnoreDebugReset);
    // this.after();
  }
}
