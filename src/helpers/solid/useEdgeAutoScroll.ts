import { type Accessor, createEffect, onCleanup } from 'solid-js';

export type ScrollAxis = 'horizontal' | 'vertical';

export interface UseEdgeAutoScrollArgs {
  container: Accessor<HTMLElement | null | undefined>;
  innerThreshold: Accessor<number>;
  outerThreshold: Accessor<number>;
  axis: Accessor<ScrollAxis>;
  interval: Accessor<number>;
  startInterval?: Accessor<number>;
  rampFactor?: Accessor<number>;
  startDelay?: Accessor<number>;
  listenTo?: Accessor<Window | HTMLElement | null | undefined>;
  enabled?: Accessor<boolean>;
  smooth?: Accessor<boolean>;
  padding?: Accessor<number>;
}

export function useEdgeAutoScroll(args: UseEdgeAutoScrollArgs): void {
  const {
    container,
    innerThreshold,
    outerThreshold,
    axis,
    interval,
    startInterval = interval,
    rampFactor = () => 0.8,
    startDelay = () => 0,
    listenTo = () => window,
    enabled = () => true,
    smooth = () => true,
    padding = () => 0,
  } = args;

  createEffect(() => {
    const el = container();
    if (!el || !enabled()) return;

    let pointerX = 0;
    let pointerY = 0;
    let pointerKnown = false;

    let activeDirection: -1 | 1 | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let armTimer: ReturnType<typeof setTimeout> | null = null;
    let currentInterval = 0;

    const isHorizontal = () => axis() === 'horizontal';

    const scrollNearestChild = (direction: -1 | 1) => {
      const rect = el.getBoundingClientRect();
      const children = Array.from(el.children);
      if (children.length === 0) return;

      const horizontal = isHorizontal();
      const containerStart = horizontal ? rect.left : rect.top;
      const containerEnd = horizontal ? rect.right : rect.bottom;

      const epsilon = 1;

      let target: HTMLElement | null = null;

      if (direction > 0) {
        for (const child of children) {
          if (!(child instanceof HTMLElement)) continue;
          const cr = child.getBoundingClientRect();
          const childEnd = horizontal ? cr.right : cr.bottom;
          if (childEnd > containerEnd + epsilon) {
            target = child;
            break;
          }
        }
      } else {
        for (let i = children.length - 1; i >= 0; i--) {
          const child = children[i];
          if (!(child instanceof HTMLElement)) continue;
          const cr = child.getBoundingClientRect();
          const childStart = horizontal ? cr.left : cr.top;
          if (childStart < containerStart - epsilon) {
            target = child;
            break;
          }
        }
      }

      if (!target) return;

      const cr = target.getBoundingClientRect();
      let delta: number;

      if (direction > 0) {
        const childEnd = horizontal ? cr.right : cr.bottom;
        delta = childEnd - containerEnd + padding();
      } else {
        const childStart = horizontal ? cr.left : cr.top;
        delta = childStart - containerStart - padding();
      }

      const behavior: ScrollBehavior = smooth() ? 'smooth' : 'auto';
      if (horizontal) {
        el.scrollBy({ left: delta, behavior });
      } else {
        el.scrollBy({ top: delta, behavior });
      }
    };

    const canScroll = (direction: -1 | 1): boolean => {
      const horizontal = isHorizontal();
      const scrollPos = horizontal ? el.scrollLeft : el.scrollTop;
      const maxScroll = horizontal ?
        el.scrollWidth - el.clientWidth :
        el.scrollHeight - el.clientHeight;
      if (direction < 0) return scrollPos > 0;
      return scrollPos < maxScroll - 1;
    };

    const resolveDirection = (): -1 | 1 | null => {
      if (!pointerKnown) return null;

      const rect = el.getBoundingClientRect();
      const horizontal = isHorizontal();

      const pos = horizontal ? pointerX : pointerY;
      const start = horizontal ? rect.left : rect.top;
      const end = horizontal ? rect.right : rect.bottom;

      const crossPos = horizontal ? pointerY : pointerX;
      const crossStart = horizontal ? rect.top : rect.left;
      const crossEnd = horizontal ? rect.bottom : rect.right;
      if (crossPos < crossStart || crossPos > crossEnd) return null;

      const inner = innerThreshold();
      const outer = outerThreshold();

      const distFromStart = pos - start;
      const distFromEnd = end - pos;

      if (distFromStart >= -outer && distFromStart <= inner) return -1;
      if (distFromEnd >= -outer && distFromEnd <= inner) return 1;
      return null;
    };

    const stop = () => {
      activeDirection = null;
      if (armTimer != null) {
        clearTimeout(armTimer);
        armTimer = null;
      }
      if (timeoutId != null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const tick = () => {
      timeoutId = null;
      if (activeDirection == null) return;
      if (!canScroll(activeDirection)) {
        stop();
        return;
      }

      scrollNearestChild(activeDirection);

      const min = interval();
      const factor = rampFactor();
      currentInterval = Math.max(min, currentInterval * factor);
      timeoutId = setTimeout(tick, currentInterval);
    };

    const begin = () => {
      armTimer = null;
      if (activeDirection == null) return;
      currentInterval = Math.max(interval(), startInterval());
      tick();
    };

    const start = (direction: -1 | 1) => {
      if (activeDirection === direction) return;
      stop();

      if (!canScroll(direction)) return;

      activeDirection = direction;

      const delay = startDelay();
      if (delay > 0) {
        armTimer = setTimeout(begin, delay);
      } else {
        begin();
      }
    };

    const evaluate = () => {
      const direction = resolveDirection();
      if (direction == null) {
        stop();
      } else {
        start(direction);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      pointerX = e.clientX;
      pointerY = e.clientY;
      pointerKnown = true;
      evaluate();
    };

    const target = listenTo();
    if (!target) return;

    target.addEventListener('pointermove', onPointerMove as EventListener);

    onCleanup(() => {
      target.removeEventListener('pointermove', onPointerMove as EventListener);
      stop();
    });
  });
}
