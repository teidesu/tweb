import {createSignal, For, onMount, Show} from 'solid-js';
import ButtonMenuToggle from '@components/buttonMenuToggle';
import {AppPrivacyAndSecurityTab} from '@components/solidJsTabs/tabs';
import {AppChatFoldersTab} from '@components/solidJsTabs/tabs';
import {
  AppGeneralSettingsTab,
  AppKeyboardShortcutsTab,
  AppLanguageTab,
  AppMyProfileTab,
  AppNotificationsTab,
  AppSpeakersAndCameraTab
} from '@components/solidJsTabs';
import lottieLoader from '@lib/rlottie/lottieLoader';
import {AppDataAndStorageTab} from '@components/solidJsTabs/tabs';
import rootScope from '@lib/rootScope';
import Row from '@components/rowTsx';
import {AppActiveSessionsTab} from '@components/solidJsTabs/tabs';
import {i18n, LangPackKey} from '@lib/langPack';
import {SliderSuperTabConstructable, SliderSuperTabEventable} from '@components/sliderTab';
import {AccountAuthorizations, Authorization} from '@layer';
import PopupElement from '@components/popups';
import Section from '@components/section';
import {AppStickersAndEmojiTab} from '@components/solidJsTabs/tabs';
import PopupPremium from '@components/popups/premium';
import apiManagerProxy from '@lib/apiManagerProxy';
import useStars from '@stores/stars';
import PopupStars from '@components/popups/stars';
import showPickUserPopup from '@components/popups/pickUser';
import PopupSendGift from '@components/popups/sendGift';
import {formatNanoton} from '@helpers/paymentsWrapCurrencyAmount';
import showLogOutPopup from '@components/popups/logOut';
import {useSuperTab} from '@components/solidJsTabs/superTabProvider';
import {usePromiseCollector} from '@components/solidJsTabs/promiseCollector';
import {useHotReloadGuard} from '@lib/solidjs/hotReloadGuard';
import {getAccountEntries, AccountEntry} from '@lib/accounts/getAccountEntries';
import {MAX_ACCOUNTS} from '@lib/accounts/constants';
import wrapEmojiText from '@lib/richTextProcessor/wrapEmojiText';

// ─────────────────────────────────────────────────────────────────────────────
// Helper — wraps a sub-tab declaration. If the tab has a static `getInitArgs`,
// fires the prefetch immediately so the per-domain promises (themes / filters /
// privacy bundle / etc.) start downloading the moment Settings opens.
// On click we await whatever was prefetched, hand it to `tab.open(...)`, and
// re-arm the prefetch after the sub-tab is destroyed.
// ─────────────────────────────────────────────────────────────────────────────

type SubTabConfig = {
  icon: Icon;
  text: LangPackKey;
  tabConstructor: SliderSuperTabConstructable;
  getInitArgs?: () => any[];
  args?: any;
};

const makeSubTabConfig = (
  icon: Icon,
  text: LangPackKey,
  tabConstructor: SliderSuperTabConstructable,
  fromTab: any
): SubTabConfig => {
  let getInitArgs: (() => any[]) | undefined;
  const g = (tabConstructor as any).getInitArgs;
  if(g) {
    getInitArgs = () => [g(fromTab)];
  }
  return {
    icon,
    text,
    tabConstructor,
    getInitArgs,
    args: getInitArgs?.()
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab UI
// ─────────────────────────────────────────────────────────────────────────────

type AccountRow = AccountEntry & {
  title: DocumentFragment;
  notificationsCount: number;
};

const Settings = () => {
  const promiseCollector = usePromiseCollector();
  const [tab] = useSuperTab();
  const {appSidebarLeft, uiNotificationsManager, AvatarNewTsx} = useHotReloadGuard();

  // ── Accounts section, mirrors the hamburger menu's account list. All data is
  //    local (storage / worker caches), so we can afford waiting on it before
  //    the open animation.
  const [accounts, setAccounts] = createSignal<AccountRow[]>([]);
  promiseCollector.collect((async() => {
    const [notificationsCount, entries] = await Promise.all([
      uiNotificationsManager.getNotificationsCountForAllAccounts(),
      getAccountEntries()
    ]);

    setAccounts(entries.map((entry) => {
      const {user, peerId, accountNumber, active} = entry;
      const name = user ? [user.first_name, user.last_name].filter(Boolean).join(' ') : '' + peerId;
      return {
        ...entry,
        title: wrapEmojiText(name),
        notificationsCount: active ? 0 : notificationsCount[accountNumber] ?? 0
      };
    }));
  })());

  const onAccountClick = (account: AccountRow) => (e: MouseEvent) => {
    if(account.active) {
      tab.slider.createTab(AppMyProfileTab).open();
      return;
    }

    appSidebarLeft.switchAccount(account.accountNumber, e.ctrlKey || e.metaKey);
  };

  // ── Header (logout overflow menu)
  const btnMenu = ButtonMenuToggle({
    listenerSetter: tab.listenerSetter,
    direction: 'bottom-left',
    buttons: [{
      icon: 'logout',
      text: 'EditAccount.Logout',
      onClick: () => showLogOutPopup()
    }]
  });

  onMount(() => {
    tab.container.classList.add('settings-container');
    tab.header.append(btnMenu);
  });

  // ── Sub-tab rows (notifications/data/privacy/general/folders/stickers).
  const subTabConfigs: SubTabConfig[] = [
    makeSubTabConfig('unmute', 'AccountSettings.Notifications', AppNotificationsTab, tab),
    makeSubTabConfig('data', 'DataSettings', AppDataAndStorageTab, tab),
    makeSubTabConfig('lock', 'AccountSettings.PrivacyAndSecurity', AppPrivacyAndSecurityTab, tab),
    makeSubTabConfig('settings', 'Telegram.GeneralSettingsViewController', AppGeneralSettingsTab, tab),
    makeSubTabConfig('folder', 'AccountSettings.Filters', AppChatFoldersTab, tab),
    makeSubTabConfig('stickers_face', 'StickersName', AppStickersAndEmojiTab, tab),
    makeSubTabConfig('videocamera', 'AccountSettings.SpeakersAndCamera', AppSpeakersAndCameraTab, tab)
  ];

  const onSubTabClick = (item: SubTabConfig) => async() => {
    const args = item.args ? await item.args : [];
    const subTab = tab.slider.createTab(item.tabConstructor as any);
    subTab.open(...args);

    if(subTab instanceof SliderSuperTabEventable && item.getInitArgs) {
      (subTab as SliderSuperTabEventable).eventListener.addEventListener('destroyAfter', (promise) => {
        item.args = promise.then(() => item.getInitArgs!() as any);
      });
    }
  };

  // ── Devices row + active sessions fetch (we wait on this so the tab opens
  //    with the device count already filled in).
  let authorizations: Authorization.authorization[] | undefined;
  let getAuthorizationsPromise: Promise<AccountAuthorizations.accountAuthorizations> | undefined;
  const [authCount, setAuthCount] = createSignal('');

  const getAuthorizations = (overwrite?: boolean) => {
    if(getAuthorizationsPromise && !overwrite) return getAuthorizationsPromise;

    const promise = getAuthorizationsPromise = rootScope.managers.appAccountManager.getAuthorizations()
    .finally(() => {
      if(getAuthorizationsPromise === promise) {
        getAuthorizationsPromise = undefined;
      }
    });

    return promise;
  };

  const updateActiveSessions = (overwrite?: boolean) => {
    return getAuthorizations(overwrite).then((auths) => {
      authorizations = auths.authorizations;
      setAuthCount('' + authorizations.length);
    });
  };

  // Fire-and-forget: `account.getAuthorizations` is a real MTProto roundtrip
  // every time (no caching). Letting the device count fill in via the
  // `authCount` signal after the tab is shown matches the legacy behaviour.
  updateActiveSessions();

  const onDevicesClick = async() => {
    if(!authorizations) {
      await updateActiveSessions();
    }

    const subTab = tab.slider.createTab(AppActiveSessionsTab);
    subTab.eventListener.addEventListener('destroy', () => {
      authorizations = undefined;
      updateActiveSessions(true);
    }, {once: true});
    subTab.open({authorizations: authorizations!});
  };

  // ── Premium section. Signal-backed so `<Show>` re-evaluates when the
  //    "purchase blocked" check resolves before `selectTab` fires — the section
  //    either appears with the rest of the tab, or doesn't appear at all.
  const [premiumBlocked, setPremiumBlocked] = createSignal(false);
  promiseCollector.collect(
    Promise.resolve(apiManagerProxy.isPremiumPurchaseBlocked()).then(setPremiumBlocked)
  );

  // ── Reactive star balances (drive both the visibility and titleRight text
  //    of stars / starsTon rows).
  const stars = useStars();
  const starsTon = useStars(true);

  // Lottie workers preload — fire and forget.
  lottieLoader.loadLottieWorkers();

  const onSendGiftClick = () => {
    showPickUserPopup({
      titleLangKey: 'SendGiftTo',
      placeholder: 'Chat.Menu.SendGift',
      selfPresence: 'SendGiftSelfCaption',
      meAsSaved: false,
      onSelect: (chosen) => {
        PopupElement.createPopup(PopupSendGift, {peerId: chosen[0].peerId});
      },
      filterPeerTypeBy: ['isRegularUser', 'isBroadcast']
    });
  };

  return (
    <>
      <Section>
        <For each={accounts()}>
          {(account) => (
            <Row clickable={onAccountClick(account)}>
              <Row.Media size="small">
                <AvatarNewTsx
                  accountNumber={account.accountNumber}
                  peerId={account.peerId}
                  peer={account.active ? undefined : account.user}
                  size={32}
                />
              </Row.Media>
              <Row.Title
                titleRight={account.notificationsCount ?
                  <span class="badge badge-20 badge-primary">{'' + account.notificationsCount}</span> :
                  undefined}
              >
                {account.title}
              </Row.Title>
            </Row>
          )}
        </For>
        <Show when={accounts().length && accounts().length < MAX_ACCOUNTS}>
          <Row clickable={(e) => appSidebarLeft.addAccount(e)}>
            <Row.Icon icon="plus" />
            <Row.Title>{i18n('MultiAccount.AddAccount')}</Row.Title>
          </Row>
        </Show>
      </Section>
      <Section>
        <div class="profile-buttons">
          <For each={subTabConfigs}>
            {(item) => (
              <Row clickable={onSubTabClick(item)}>
                <Row.Icon icon={item.icon} />
                <Row.Title>{i18n(item.text)}</Row.Title>
              </Row>
            )}
          </For>
          <Row clickable={onDevicesClick}>
            <Row.Icon icon="activesessions" />
            <Row.Title titleRight={<span>{authCount()}</span>} titleRightSecondary>
              {i18n('Devices')}
            </Row.Title>
          </Row>
          <Row clickable={() => tab.slider.createTab(AppLanguageTab).open()}>
            <Row.Icon icon="language" />
            <Row.Title titleRight={i18n('LanguageName')} titleRightSecondary>
              {i18n('AccountSettings.Language')}
            </Row.Title>
          </Row>
          <Row clickable={() => tab.slider.createTab(AppKeyboardShortcutsTab).open()}>
            <Row.Icon icon="keyboard" />
            <Row.Title>{i18n('KeyboardShortcuts.Title')}</Row.Title>
          </Row>
        </div>
      </Section>
      <Show when={!premiumBlocked()}>
        <Section>
          <Row clickable={() => PopupPremium.show()}>
            <Row.Icon icon="star" class="row-icon-premium-color" />
            <Row.Title>{i18n('Premium.Boarding.Title')}</Row.Title>
          </Row>
          <Show when={!!stars()}>
            <Row clickable={() => PopupElement.createPopup(PopupStars)}>
              <Row.Icon icon="star" class="row-icon-stars-color" />
              <Row.Title titleRight={'' + stars()} titleRightSecondary>
                {i18n('MenuTelegramStars')}
              </Row.Title>
            </Row>
          </Show>
          <Show when={String(starsTon()) !== '0'}>
            <Row clickable={() => PopupElement.createPopup(PopupStars, {ton: true})}>
              <Row.Icon icon="ton" />
              <Row.Title titleRight={formatNanoton(starsTon())} titleRightSecondary>
                {i18n('MenuTelegramStarsTon')}
              </Row.Title>
            </Row>
          </Show>
          <Row clickable={onSendGiftClick}>
            <Row.Icon icon="gift" />
            <Row.Title>{i18n('Chat.Menu.SendGift')}</Row.Title>
          </Row>
        </Section>
      </Show>
    </>
  );
};

export default Settings;
