import {createComputed, createEffect, createMemo, createSignal, Show} from 'solid-js';
import createMiddleware from '@helpers/solid/createMiddleware';
import {CustomEmojiRendererElement} from '@lib/customEmoji/renderer';
import {useHotReloadGuard} from '@lib/solidjs/hotReloadGuard';
import Badge from '@components/badge';
import {IconTsx} from '@components/iconTsx';
import FolderAnimatedIcon from '@components/sidebarLeft/foldersSidebarContent/folderAnimatedIcon';
import {FolderItemPayload} from '@components/sidebarLeft/foldersSidebarContent/types';


type FolderItemProps = FolderItemPayload & {
  ref?: (el: HTMLDivElement | null) => void,
  class?: string,
  selected?: boolean,
  onClick?: () => void
};

const ICON_SIZE = 30;
const BADGE_CUTOUT_GAP = 2;

// Punches a rounded-rect hole (badge bounds + gap on every side) out of the icon so a
// transparent gap separates the unread badge from the glyph behind it. Coordinates are
// relative to iconEl's border-box, the reference box for clip-path.
function buildBadgeCutoutClipPath(iconEl: HTMLElement, badgeEl: HTMLElement): string | undefined {
  const icon = iconEl.getBoundingClientRect();
  const badge = badgeEl.getBoundingClientRect();
  if(!icon.width || !badge.width) return;

  const gap = BADGE_CUTOUT_GAP;
  const x = badge.left - icon.left - gap;
  const y = badge.top - icon.top - gap;
  const w = badge.width + gap * 2;
  const h = badge.height + gap * 2;
  const r = Math.min(w, h) / 2;

  const f = (n: number) => n.toFixed(2);
  // Overscan the outer rect so it never clips the glyph itself.
  const o = Math.max(icon.width, icon.height) + 100;

  // evenodd: outer covers the whole icon, inner subtracts the badge pill.
  const outer = `M${-o} ${-o}H${f(icon.width + o)}V${f(icon.height + o)}H${-o}Z`;
  const inner = `M${f(x + r)} ${f(y)}` +
    `H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)}` +
    `V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)}` +
    `H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)}` +
    `V${f(y + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)}Z`;

  return `path(evenodd,'${outer}${inner}')`;
}

export default function FolderItem(props: FolderItemProps) {
  const {rootScope, wrapFolderTitle} = useHotReloadGuard();

  const [failedToFetchIconDoc, setFailedToFetchIconDoc] = createSignal(false);

  let iconWrapRef: HTMLDivElement;
  let badgeRef: HTMLElement;
  const [clipPath, setClipPath] = createSignal<string>();

  const hasNotifications = () => !!props.notifications?.count;

  createEffect(() => {
    if(!hasNotifications()) {
      setClipPath(undefined);
      return;
    }

    // re-measure on digit-count change
    props.notifications!.count;
    setClipPath(iconWrapRef! && badgeRef && buildBadgeCutoutClipPath(iconWrapRef, badgeRef));
  });

  const hasCustomIcon = () => props.iconDocId || props.emojiIcon;
  const showCustomIcon = () => hasCustomIcon() && !failedToFetchIconDoc();

  const title = createMemo(() => {
    if(props.name) return props.name;
    if(!props.title) return;

    const middleware = createMiddleware().get();

    const span = document.createElement('span');
    const fragment = wrapFolderTitle(props.title, middleware, true);

    createEffect(() => {
      const renderer: CustomEmojiRendererElement = span.querySelector('custom-emoji-renderer-element')!;
      renderer?.setTextColor(props.selected ? 'primary-color' : 'folders-sidebar-item-color')
    });

    span.append(fragment);

    return span;
  });

  createComputed(() => {
    hasCustomIcon() && setFailedToFetchIconDoc(false);
  });

  return (
    <div
      ref={(el) => {
        props.ref?.(el);
      }}
      class="folders-sidebar__folder-item"
      classList={{
        [props.class!]: !!props.class,
        'folders-sidebar__folder-item--selected': props.selected
      }}
      {...(props.id !== undefined ?
        {'data-filter-id': props.id} :
        {}
      )}
      onClick={props.onClick}
    >
      <div
        ref={iconWrapRef!}
        class="folders-sidebar__folder-item-icon-wrap"
        style={{'clip-path': clipPath(), '-webkit-clip-path': clipPath()}}
      >
        <Show
          when={showCustomIcon()}
          fallback={<IconTsx icon={props.icon} class="folders-sidebar__folder-item-icon" />}
        >
          <FolderAnimatedIcon
            docId={props.iconDocId}
            emoji={props.emojiIcon}
            color={props.selected ? 'primary-color' : 'folders-sidebar-item-color'}
            managers={rootScope.managers}
            size={ICON_SIZE}
            class="folders-sidebar__folder-item-animated-icon"
            onFail={() => setFailedToFetchIconDoc(true)}
            dontAnimate={props.dontAnimate}
          />
        </Show>
      </div>
      <Show when={title()}>
        <div class="folders-sidebar__folder-item-name">{title()}</div>
      </Show>
      <Show when={hasNotifications()}>
        <Badge
          ref={(el) => badgeRef = el}
          class="folders-sidebar__folder-item-badge"
          tag="div"
          color={props.notifications!.muted/*  && !props.selected */ ? 'gray' : 'primary'}
          size={18}
        >
          {'' + props.notifications!.count}
        </Badge>
      </Show>
    </div>
  );
}
