import { For, onMount, Show } from 'solid-js';
import { Reaction } from '@/layer';
import { Middleware } from '@/helpers/middleware';
import { AvatarNewTsx } from '@/components/avatarNew';
import { PeerTitleTsx } from '@/components/peerTitleTsx';
import { wrapReactionIcon } from '@/components/popups/reactedList';
import clsx from 'clsx';
import styles from './reactedListSubmenu.module.scss';

export type ReactedListSubmenuEntry = {
  peerId: PeerId,
  reaction?: Reaction
};

function ReactionIcon(props: { reaction: Reaction, middleware: Middleware }) {
  let ref!: HTMLDivElement;
  onMount(() => {
    wrapReactionIcon({ reaction: props.reaction, container: ref, middleware: props.middleware });
  });
  return <div ref={ref} class={/* @once */ styles.reaction} />;
}

export default function ReactedListSubmenu(props: {
  entries: ReactedListSubmenuEntry[],
  middleware: Middleware,
  onSelect: (peerId: PeerId) => void,
  class?: string
}) {
  return (
    <div class={/* @once */ clsx('btn-menu', styles.submenu, props.class)}>
      <For each={props.entries}>
        {(entry) => (
          <div
            class={/* @once */ 'btn-menu-item rp-overflow'}
            onClick={() => props.onSelect(entry.peerId)}
          >
            <AvatarNewTsx
              class={/* @once */ 'btn-menu-item-icon btn-menu-item-avatar'}
              peerId={entry.peerId}
              size={22}
            />
            <PeerTitleTsx class={/* @once */ 'btn-menu-item-text'} peerId={entry.peerId} />
            <Show when={entry.reaction}>
              <ReactionIcon reaction={entry.reaction!} middleware={props.middleware} />
            </Show>
          </div>
        )}
      </For>
    </div>
  );
}
