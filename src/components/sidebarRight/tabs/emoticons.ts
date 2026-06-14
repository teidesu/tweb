import { SliderSuperTab } from '@components/slider';
import emoticonsDropdown from '@components/emoticonsDropdown';
import appSidebarRight from '@components/sidebarRight';
import { setAppSettings } from '@stores/appSettings';

export default class AppEmoticonsTab extends SliderSuperTab {
  public static noSame = true;

  // set for closes that shouldn't reset the persisted preference (layout
  // transitions like entering the floating range or shrinking to medium screen)
  private transient: boolean;

  public init() {
    this.container.classList.add('emoticons-container');

    this.header.remove();
    // the panel manages its own scrolling
    this.scrollable.container.remove();

    return emoticonsDropdown.dock(this.content);
  }

  // the ESG panel can't live in a hidden column — undock it
  public onSidebarHide(persist: boolean) {
    this.transient = !persist;
    this.close();
  }

  protected onClose() {
    if (!this.transient) {
      setAppSettings('esgInSidebar', false);
    }
  }

  protected onCloseAfterTimeout() {
    emoticonsDropdown.undock(this.content);
    return super.onCloseAfterTimeout();
  }
}

export async function openEmoticonsPanel(animate?: boolean, persist = true) {
  let tab = appSidebarRight.getTab(AppEmoticonsTab);
  if (!tab) {
    if (persist) {
      setAppSettings('esgInSidebar', true);
    }

    tab = appSidebarRight.createTab(AppEmoticonsTab);
    await tab.openInstant();
    appSidebarRight.sliceTabsUntilTab(AppEmoticonsTab, tab);
  }

  return appSidebarRight.toggleSidebar(true, animate, persist);
}

export function closeEmoticonsPanel() {
  appSidebarRight.getTab(AppEmoticonsTab)?.close();
}

export function replaceEmoticonsPanelWithProfile() {
  const tab = appSidebarRight.getTab(AppEmoticonsTab);
  if (!tab) {
    return false;
  }

  appSidebarRight.sharedMediaTab.openInstant().then(() => {
    appSidebarRight.removeTabFromHistory(tab);
  });
  return true;
}
