import { onMount } from 'solid-js';
import ButtonIcon from '@/components/buttonIcon';
import ButtonMenuToggle from '@/components/buttonMenuToggle';
import rootScope from '@/lib/rootScope';
import { attachClickEvent } from '@/helpers/dom/clickEvent';
import { renderPeerProfile } from '@/components/peerProfile';
import SolidJSHotReloadGuardProvider from '@/lib/solidjs/hotReloadGuardProvider';
import showMyQrCodePopup from '@/components/popups/myQrCode';
import AppSearchSuper, { SearchSuperMediaTab } from '@/components/appSearchSuper';
import { profileStoriesButtonMenu } from '@/components/stories/profileList';
import { profileStarGiftsButtonMenu } from '@/components/stargifts/profileList';
import { AppEditProfileTab, getEditProfileInitArgs } from '@/components/solidJsTabs';
import { useSuperTab } from '@/components/solidJsTabs/superTabProvider';
import { usePromiseCollector } from '@/components/solidJsTabs/promiseCollector';
import { subscribeOn } from '@/helpers/solid/subscribeOn';

const MyProfile = () => {
  const promiseCollector = usePromiseCollector();
  const [tab] = useSuperTab();

  let lastMediaTabType: SearchSuperMediaTab['type'];
  const searchSuper = new AppSearchSuper({
    mediaTabs: [{
      name: 'Stories',
      type: 'stories',
    }, {
      name: 'SharedMedia.Gifts',
      type: 'gifts',
    }],
    scrollable: tab.scrollable,
    onChangeTab: (mediaTab) => {
      lastMediaTabType = mediaTab.type;
    },
    managers: tab.managers,
    slider: tab.slider,
    scrollOffset: 72, // header height + section padding, same as sharedMedia
    isSelfProfile: true,
  });

  (tab as any)._onCloseAfterTimeout = () => {
    searchSuper.destroy();
  };

  const qrBtn = ButtonIcon('qr');
  const editBtn = ButtonIcon('edit');
  const btnMenu = ButtonMenuToggle({
    listenerSetter: tab.listenerSetter,
    direction: 'bottom-left',
    buttons: [
      ...profileStoriesButtonMenu({
        peerId: rootScope.myId,
        slider: tab.slider,
        verify: () => lastMediaTabType === 'stories',
      }),
      ...profileStarGiftsButtonMenu({
        get store() { return searchSuper.stargiftsStore },
        get actions() { return searchSuper.stargiftsActions },
        verify: () => lastMediaTabType === 'gifts',
        peerId: rootScope.myId,
      }),
    ],
  });

  onMount(() => {
    tab.container.classList.add('shared-media-container');
    tab.header.append(qrBtn, editBtn, btnMenu);
  });

  attachClickEvent(qrBtn, () => {
    showMyQrCodePopup();
  }, { listenerSetter: tab.listenerSetter });

  let editProfileArgs: ReturnType<typeof getEditProfileInitArgs>;
  const refreshEditProfileArgs = () => {
    editProfileArgs = getEditProfileInitArgs();
  };
  refreshEditProfileArgs();
  attachClickEvent(editBtn, () => {
    tab.slider.createTab(AppEditProfileTab).open(editProfileArgs);
  }, { listenerSetter: tab.listenerSetter });

  subscribeOn(rootScope)('user_update', (userId) => {
    if (rootScope.myId.toUserId() === userId) {
      refreshEditProfileArgs();
    }
  });

  const peerProfileElement = renderPeerProfile({
    peerId: rootScope.myId,
    isDialog: false,
    scrollable: tab.scrollable,
    setCollapsedOn: tab.container,
    searchSuperContainer: searchSuper.container,
    onPinnedGiftsChange: (gifts) => {
      searchSuper.setPinnedGifts(gifts);
    },
    onAvatarReady: (promise) => promiseCollector.collect(promise),
  }, SolidJSHotReloadGuardProvider);

  searchSuper.setQuery({ peerId: rootScope.myId });
  // fire-and-forget: the tab open animation shouldn't wait for media roundtrips
  const loadPromise = searchSuper.load(true);

  (tab as any)._openGiftsCollection = async(collectionId: number) => {
    await loadPromise;
    searchSuper.selectTab(searchSuper.mediaTabs.findIndex((mediaTab) => mediaTab.type === 'gifts'));
    searchSuper.stargiftsActions?.setFilters({ chosenCollection: collectionId });
  };

  return <>{peerProfileElement}</>;
};

export default MyProfile;
