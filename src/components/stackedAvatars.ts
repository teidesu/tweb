import type LazyLoadQueue from '@/components/lazyLoadQueue';
import { getMiddleware, Middleware, MiddlewareHelper } from '@/helpers/middleware';
import { avatarNew } from '@/components/avatarNew';
import { createEffect, on, onCleanup } from 'solid-js';
import styles from '@/components/stackedAvatars.module.scss';

export default class StackedAvatars {
  public container: HTMLElement;
  private lazyLoadQueue: LazyLoadQueue;
  private avatarSize: number;
  private middlewareHelper: MiddlewareHelper;

  constructor(options: {
    lazyLoadQueue?: StackedAvatars['lazyLoadQueue'],
    avatarSize: StackedAvatars['avatarSize'],
    middleware: Middleware,
    class?: string
  }) {
    this.lazyLoadQueue = options.lazyLoadQueue!;
    this.avatarSize = options.avatarSize;
    this.middlewareHelper = options.middleware.create();

    this.container = document.createElement('div');
    this.container.classList.add(styles.container);
    if (options.class) {
      this.container.classList.add(...options.class.split(' '));
    }

    this.container.style.setProperty('--stacked-avatars-avatar-size', options.avatarSize + 'px');
  }

  /**
   * MACOS, ANDROID - без реверса
   * WINDOWS DESKTOP - реверс
   * все приложения накладывают аватарку первую на вторую, а в макете зато вторая на первую, ЛОЛ!
   */
  public render(peerIds: PeerId[], loadPromises: Promise<any>[] = []) {
    const children = this.container.children;
    peerIds = peerIds.slice().reverse();
    if (peerIds.length > 3) {
      peerIds = peerIds.slice(-3);
    }

    peerIds.forEach((peerId, idx) => {
      let avatarContainer = children[idx] as HTMLElement;
      if (!avatarContainer) {
        avatarContainer = document.createElement('div');
        avatarContainer.classList.add(styles.avatarContainer);
        avatarContainer.middlewareHelper = this.middlewareHelper.get().create();
      } else {
        avatarContainer.middlewareHelper!.clean();
      }

      const avatarElem = avatarNew({
        middleware: avatarContainer.middlewareHelper!.get(),
        size: this.avatarSize,
        isDialog: false,
        lazyLoadQueue: this.lazyLoadQueue,
        peerId,
      });
      avatarElem.node.classList.add(styles.avatar);
      loadPromises?.push(avatarElem.readyThumbPromise);

      avatarContainer.replaceChildren(avatarElem.node);

      if (!avatarContainer.parentNode) {
        this.container.append(avatarContainer);
      }

      avatarContainer.classList.toggle(styles.first, idx === 0);
      avatarContainer.classList.toggle(styles.last, idx === peerIds.length - 1);
    });

    // if were 3 and became 2
    (Array.from(children) as HTMLElement[]).slice(peerIds.length).forEach((el) => {
      el.middlewareHelper!.destroy();
      el.remove();
    });

    return Promise.all(loadPromises);
  }
}

export function StackedAvatarsTsx(props: {
  peerIds: PeerId[],
  avatarSize: number,
  lazyLoadQueue?: StackedAvatars['lazyLoadQueue'],
  class?: string,
}) {
  const middleware = getMiddleware()
  const stackedAvatars = new StackedAvatars({
    avatarSize: props.avatarSize,
    lazyLoadQueue: props.lazyLoadQueue,
    middleware: middleware.get(),
    class: props.class,
  });

  onCleanup(() => middleware.destroy());

  createEffect(on(() => props.peerIds, (peerIds) => {
    stackedAvatars.render(peerIds);
  }));

  return stackedAvatars.container;
}
