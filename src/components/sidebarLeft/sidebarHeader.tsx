import { createEffect, createSignal, onCleanup } from 'solid-js';
import ButtonIcon from '@/components/buttonIcon';
import styles from '@/components/sidebarLeft/sidebarHeader.module.scss';
import createLockButton from '@/components/sidebarLeft/lockButton';
import rootScope from '@/lib/rootScope';
import { useAppSettings } from '@/stores/appSettings';
import useHasFoldersSidebar, {
  useIsSidebarCollapsed,
  useHasOpenLeftTabs,
  useFoldersSidebarShown,
} from '@/stores/foldersSidebar';

type SidebarHeaderProps = {
  sidebarHeader: HTMLElement,
  toolsBtn: HTMLElement,
  backBtn: HTMLElement,
  buttonsContainer: HTMLElement,
  onOpenSearch: () => void,
};

export function SidebarHeader(props: SidebarHeaderProps) {
  const [hasFoldersSidebar] = useHasFoldersSidebar();
  const [isCollapsed] = useIsSidebarCollapsed();
  const [hasOpenLeftTabs] = useHasOpenLeftTabs();
  const [foldersSidebarShown] = useFoldersSidebarShown();

  // Icon-only search affordance: shown only when the folders bar is present,
  // the sidebar is collapsed and nothing is open over it.
  const searchTriggerVisible = () => hasFoldersSidebar() && isCollapsed() && !hasOpenLeftTabs();

  // Burger has two states — menu icon vs back arrow. When the folders panel is
  // shown it owns the menu trigger, so the in-sidebar burger stays as back.
  // Gate on the viewport-aware *shown* value, not the raw preference.
  const animatedMenuIcon = props.buttonsContainer.firstElementChild as HTMLElement;
  createEffect(() => {
    const showBack = foldersSidebarShown();
    props.toolsBtn.classList.toggle('is-visible', !showBack);
    props.backBtn.classList.toggle('is-visible', showBack);
    animatedMenuIcon.classList.toggle('state-back', showBack);
  });

  const [appSettings] = useAppSettings();
  const [usingPasscode, setUsingPasscode] = createSignal(!!appSettings.passcode?.enabled);
  rootScope.addEventListener('toggle_using_passcode', setUsingPasscode);
  onCleanup(() => rootScope.removeEventListener('toggle_using_passcode', setUsingPasscode));

  const lockButton = createLockButton();
  onCleanup(() => lockButton.dispose());
  createEffect(() => {
    if (usingPasscode()) props.sidebarHeader.append(lockButton.element);
    else lockButton.element.remove();

    props.sidebarHeader.classList.toggle('is-input-the-last-child', !usingPasscode());
  });

  return (
    <div
      class={/* @once */ styles.searchTrigger}
      classList={{ [styles.visible]: searchTriggerVisible() }}
      onClick={() => props.onOpenSearch()}
    >
      {ButtonIcon('search')}
    </div>
  );
}
