import {children, createContext, createEffect, createMemo, createSignal, JSX, on, onCleanup, onMount, Ref, untrack} from 'solid-js';
import {IS_OVERLAY_SCROLL_SUPPORTED} from '@environment/overlayScrollSupport';
import IS_TOUCH_SUPPORTED from '@environment/touchSupport';
import {IS_MOBILE_SAFARI, IS_SAFARI} from '@environment/userAgent';
import cancelEvent from '@helpers/dom/cancelEvent';
import classNames from '@helpers/string/classNames';
import useHeavyAnimationCheck from '@hooks/useHeavyAnimationCheck';
import {syncThumbContainerGeometry} from '@components/scrollable';

const SCROLL_THROTTLE = /* IS_ANDROID ? 200 :  */24;

function throttleMeasurement(callback: () => void): number {
  if(!IS_OVERLAY_SCROLL_SUPPORTED()) {
    return requestAnimationFrame(callback);
  }
  return window.setTimeout(callback, SCROLL_THROTTLE);
}

function cancelMeasurement(id: number): void {
  if(!IS_OVERLAY_SCROLL_SUPPORTED()) {
    cancelAnimationFrame(id);
  } else {
    window.clearTimeout(id);
  }
}

export type ScrollableContextValue = {
  scrollPosition: number,
  scrollSize: number,
  clientSize: number,
  offsetSize: number,
  getDistanceToEnd: () => number,
  container: HTMLDivElement,
  onSizeChange: () => void,
  setScrollPositionSilently: (value: number) => void,
  checkForTriggers: () => void
};

export const ScrollableContext = createContext<ScrollableContextValue>();

export default function Scrollable(props: {
  children: JSX.Element,
  ref?: Ref<HTMLDivElement>,
  thumbRef?: (el: HTMLDivElement) => void,
  contextRef?: (ctx: ScrollableContextValue) => void,
  class?: string,
  classList?: JSX.HTMLAttributes<HTMLDivElement>['classList'],
  style?: JSX.CSSProperties,
  axis?: 'x' | 'y',
  withBorders?: 'both' | 'top' | 'bottom' | 'manual',
  onScrolledTop?: () => void,
  onScrolledBottom?: () => void,
  onScroll?: () => void,
  onScrollOffset?: number,
  relative?: boolean
}) {
  const axis = props.axis ?? 'y';
  const scrollPositionProperty: 'scrollTop' | 'scrollLeft' = axis === 'x' ? 'scrollLeft' : 'scrollTop';
  const scrollSizeProperty: 'scrollHeight' | 'scrollWidth' = axis === 'x' ? 'scrollWidth' : 'scrollHeight';
  const clientSizeProperty: 'clientHeight' | 'clientWidth' = axis === 'x' ? 'clientWidth' : 'clientHeight';
  const offsetSizeProperty: 'offsetHeight' | 'offsetWidth' = axis === 'x' ? 'offsetWidth' : 'offsetHeight';
  const clientAxis: 'clientY' | 'clientX' = axis === 'x' ? 'clientX' : 'clientY';

  const [ignoreScrollEvent, setIgnoreScrollEvent] = createSignal(false);
  const scrollPosition = () => ref[scrollPositionProperty];
  const setScrollPosition = (value: number) => ref[scrollPositionProperty] = value;
  const scrollSize = () => ref[scrollSizeProperty];
  const clientSize = () => ref[clientSizeProperty];
  const offsetSize = () => ref[offsetSizeProperty];
  const getDistanceToEnd = () => scrollSize() - Math.round(scrollPosition() + offsetSize());

  const onScrollOffset = createMemo(() => props.onScrollOffset ?? 300);

  let lastScrollDirection: -1 | 0 | 1 = 0;
  let lastScrollPosition = 0;

  let startMousePosition: number;
  let startScrollPosition: number;

  let isHeavyAnimationInProgress = false;
  let needCheckAfterAnimation = false;

  const [isScrolledToStart, setIsScrolledToStart] = createSignal(true);
  const [isScrolledToEnd, setIsScrolledToEnd] = createSignal(true);

  let onScrollMeasure = 0;

  const removeHeavyAnimationListener = useHeavyAnimationCheck(() => {
    isHeavyAnimationInProgress = true;

    if(onScrollMeasure) {
      cancelMeasure();
      needCheckAfterAnimation = true;
    }
  }, () => {
    isHeavyAnimationInProgress = false;

    if(needCheckAfterAnimation) {
      onScroll();
      needCheckAfterAnimation = false;
    }
  });

  onCleanup(removeHeavyAnimationListener);

  const onScroll = () => {
    // if(this.debug) {
    // this.log('onScroll call', this.onScrollMeasure);
    // }

    // return;

    if(isHeavyAnimationInProgress) {
      cancelMeasure();
      needCheckAfterAnimation = true;
      return;
    }

    // if(this.onScrollMeasure || ((this.scrollLocked || (!this.onScrolledTop && !this.onScrolledBottom)) && !this.splitUp && !this.onAdditionalScroll)) return;
    if((!props.onScrolledTop && !props.onScrolledBottom)/*  && !this.splitUp */ && !onScrollCallbacks().length && IS_OVERLAY_SCROLL_SUPPORTED()) return;

    // cache scroll position to avoid forced reflows if the layout is dirty in the throttled measure
    capturedScrollPosition = scrollPosition();

    if(onScrollMeasure) return;
    onScrollMeasure = throttleMeasurement(() => {
      onScrollMeasure = 0;

      if(sizesDirty) {
        refreshMeasurements();
      }

      const _scrollPosition = capturedScrollPosition;
      lastScrollDirection = lastScrollPosition === _scrollPosition ? 0 : (lastScrollPosition < _scrollPosition ? 1 : -1); // * 1 - bottom, -1 - top
      lastScrollPosition = _scrollPosition;

      updateThumb(_scrollPosition, false);

      // lastScrollDirection check is useless here, every callback should decide on its own
      if(true/*  && lastScrollDirection !== 0 */) {
        onScrollCallbacks().forEach((callback) => callback());
      }

      checkForTriggers();
    });
  };

  const cancelMeasure = () => {
    if(onScrollMeasure) {
      cancelMeasurement(onScrollMeasure);
      onScrollMeasure = 0;
    }
  };

  const checkForTriggers = () => {
    if(!props.onScrolledTop && !props.onScrolledBottom) return;

    // if(this.isHeavyAnimationInProgress) {
    //   this.onScroll();
    //   return;
    // }

    if(sizesDirty) {
      refreshMeasurements();
    }

    const _scrollSize = cachedScrollSize;
    if(!_scrollSize) { // незачем вызывать триггеры если блок пустой или не виден
      return;
    }

    // lastScrollPosition is in sync: the scroll measure updates it right
    // before calling here, external callers (force-checking after a content
    // load) come after a measure or a silent set
    const _scrollPosition = lastScrollPosition;
    const _onScrollOffset = onScrollOffset();
    const maxScrollPosition = _scrollSize - cachedOffsetSize;

    // this.log('checkForTriggers:', scrollTop, maxScrollTop);

    if(props.onScrolledTop && _scrollPosition <= _onScrollOffset && lastScrollDirection <= 0/* && direction === -1 */) {
      props.onScrolledTop();
    }

    if(props.onScrolledBottom && (maxScrollPosition - _scrollPosition) <= _onScrollOffset && lastScrollDirection >= 0/* && direction === 1 */) {
      props.onScrolledBottom();
    }
  };

  const checkEnds = () => {
    // runs from the scroll measure: lastScrollPosition and the caches were
    // refreshed right before
    setIsScrolledToStart(!lastScrollPosition);
    setIsScrolledToEnd(cachedScrollSize - Math.round(lastScrollPosition + cachedOffsetSize) <= 1);
  };

  let lastThumbGeometry = '';
  let cachedScrollSize = -1;
  let cachedClientSize = -1;
  let cachedOffsetSize = -1;
  let sizesDirty = true;
  let capturedScrollPosition = 0;

  // Layout reads are confined here and run only when something invalidated
  // them (content mutation, resize, explicit signal) — a plain scroll frame
  // computes the thumb and the triggers entirely from caches, so it never
  // forces a reflow when unrelated code dirtied layout mid-frame.
  const refreshMeasurements = () => {
    sizesDirty = false;
    cachedScrollSize = scrollSize();
    cachedClientSize = clientSize();
    cachedOffsetSize = offsetSize();
    if(thumbContainerRef?.parentElement) {
      lastThumbGeometry = syncThumbContainerGeometry(ref, thumbContainerRef, lastThumbGeometry);
    }
  };

  const invalidateMeasurements = () => {
    sizesDirty = true;
    onScroll();
  };

  // The thumb overlays the scroller from outside, as a sibling: any descendant
  // (even position: sticky) rides the macOS rubber-band overscroll bounce
  // together with the content, while a sibling stays pinned. Inserted
  // imperatively (not as a JSX sibling) so the component stays single-rooted —
  // transition wrappers track only the first node of a fragment. Adjacency is
  // re-asserted on every update: wrappers may move the scroller without us.
  const ensureThumbAttached = () => {
    if(!ref.parentElement) {
      thumbContainerRef.remove();
      lastThumbGeometry = '';
      return false;
    }

    if(ref.nextElementSibling !== thumbContainerRef) {
      ref.after(thumbContainerRef);
      // an attach/move means the container's offsets may have changed too
      sizesDirty = true;
    }

    return true;
  };

  // fresh = re-read layout: the default for external callers (they signal a
  // change we can't observe synchronously); scroll measures pass false and
  // consume the caches
  const updateThumb = (_scrollPosition = scrollPosition(), fresh = true) => {
    if(IS_OVERLAY_SCROLL_SUPPORTED() || !thumbRef) {
      return;
    }

    if(!ensureThumbAttached()) {
      return;
    }

    if(fresh || sizesDirty) {
      refreshMeasurements();
    }

    const _scrollSize = cachedScrollSize;
    const _clientSize = cachedClientSize;
    // Safari reports out-of-bounds positions during rubber-band overscroll
    _scrollPosition = Math.max(0, Math.min(_scrollPosition, _scrollSize - _clientSize));
    const divider = _scrollSize / _clientSize / 0.75;
    const thumbSize = Math.max(20, _clientSize / divider);
    const value = _scrollPosition / (_scrollSize - _clientSize) * _clientSize;
    // const b = (scrollPosition + clientSize) / scrollSize;
    const b = _scrollPosition / (_scrollSize - _clientSize);
    const maxValue = _clientSize - thumbSize;
    if(_clientSize < _scrollSize) {
      thumbRef.style.height = thumbSize + 'px';
      // this.thumb.style.top = `${Math.min(maxValue, value - thumbSize * b)}px`;
      thumbRef.style.transform = `translateY(${Math.min(maxValue, value - thumbSize * b)}px)`;
    } else {
      thumbRef.style.height = '0px';
    }
  };

  const setScrollPositionSilently = (value: number) => {
    lastScrollPosition = value;
    // a pending measure must not consume a position captured before the jump
    capturedScrollPosition = value;
    ignoreNextScrollEvent();

    setScrollPosition(value);
  };

  const ignoreNextScrollEvent = () => {
    setIgnoreScrollEvent(true);
    ref.addEventListener('scroll', (e) => {
      cancelEvent(e);
      setIgnoreScrollEvent(false);
      // this.addScrollListener();
    }, {capture: true, passive: false, once: true});
  };

  const onScrollCallbacks = createMemo(() => [props.onScroll, props.withBorders && checkEnds].filter(Boolean));

  const onThumbMouseMove = (e: MouseEvent) => {
    cancelEvent(e);

    // caches are fresh here: the thumb is only draggable while visible, and
    // visibility implies a recent updateThumb
    const contentHeight = cachedScrollSize;
    const viewportHeight = cachedClientSize;
    const scrollbarSize = thumbRef.offsetHeight;
    const maxScrollTop = contentHeight - viewportHeight;

    const maxScrollbarOffset = viewportHeight - scrollbarSize;
    const deltaY = e[clientAxis] - startMousePosition;
    const scrollAmount = (deltaY / maxScrollbarOffset) * maxScrollTop;
    const newScrollTop = startScrollPosition + scrollAmount;

    ref[scrollPositionProperty] = newScrollTop;
  };

  const onThumbMouseDown = (e: MouseEvent) => {
    cancelEvent(e);
    startMousePosition = e[clientAxis];
    startScrollPosition = scrollPosition();
    (e.target as HTMLElement).classList.add('is-focused');

    window.addEventListener('mousemove', onThumbMouseMove);
    window.addEventListener('mouseup', onThumbMouseUp, {once: true});
  };

  const onThumbMouseUp = (e: MouseEvent) => {
    window.removeEventListener('mousemove', onThumbMouseMove);
    thumbRef.classList.remove('is-focused');
  };

  const onWheel = (e: WheelEvent) => {
    e.stopPropagation();
    const container = ref;
    if(!e.deltaX && container.scrollWidth > container.clientWidth) {
      container.scrollLeft += e.deltaY / 4;
      cancelEvent(e);
    }
  };

  const onSizeChange = () => {
    invalidateMeasurements();
  };

  onMount(() => {
    // ResizeObserver covers the container's own box, MutationObserver covers
    // content changes that only affect scrollSize — together they invalidate
    // the measurement caches so scroll frames never have to read layout
    const resizeObserver = new ResizeObserver(invalidateMeasurements);
    resizeObserver.observe(ref);
    const mutationObserver = new MutationObserver(invalidateMeasurements);
    mutationObserver.observe(ref, {childList: true, subtree: true});
    onCleanup(() => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    });
  });

  const value: ScrollableContextValue = {
    get scrollPosition() {
      return scrollPosition();
    },
    get scrollSize() {
      return scrollSize();
    },
    get clientSize() {
      return clientSize();
    },
    get offsetSize() {
      return offsetSize();
    },
    getDistanceToEnd,
    get container() {
      return ref;
    },
    onSizeChange,
    setScrollPositionSilently,
    checkForTriggers
  };

  if(props.contextRef) {
    untrack(() => props.contextRef)(value);
  }

  const resolvedChildren = children(() => {
    return (
      <ScrollableContext.Provider value={value}>
        {props.children}
      </ScrollableContext.Provider>
    );
  });

  createEffect(on(resolvedChildren, onSizeChange));

  let ref: HTMLDivElement, thumbRef: HTMLDivElement, thumbContainerRef: HTMLDivElement;

  const withThumb = !IS_OVERLAY_SCROLL_SUPPORTED() && axis === 'y';
  if(withThumb) {
    thumbContainerRef = (
      <div class="scrollable-thumb-container">
        <div
          class="scrollable-thumb"
          ref={(el) => {
            thumbRef = el;
            props.thumbRef?.(el);
          }}
          onMouseDown={onThumbMouseDown}
        ></div>
      </div>
    ) as HTMLDivElement;
    onCleanup(() => thumbContainerRef.remove());
  }

  return (
    <div
      ref={(_ref) => {
        ref = _ref;
        (props.ref as any)?.(_ref);
      }}
      class={classNames(
        'scrollable',
        `scrollable-${axis}`,
        props.class,
        props.relative && 'relative',
        IS_SAFARI && !IS_MOBILE_SAFARI && 'no-scrollbar',
        ...(props.withBorders ? [
          isScrolledToStart() && 'scrolled-start',
          isScrolledToEnd() && 'scrolled-end',
          axis === 'y' && 'scrollable-y-bordered',
          (props.withBorders === 'top' || props.withBorders === 'both') && 'scrollable-y-bordered-top',
          (props.withBorders === 'bottom' || props.withBorders === 'both') && 'scrollable-y-bordered-bottom'
        ] : [])
      )}
      onScroll={!ignoreScrollEvent() && onScroll}
      classList={props.classList}
      style={props.style}
      onWheel={(axis === 'x' && !IS_TOUCH_SUPPORTED && onWheel) || undefined}
      // the thumb overlay is attached/positioned by JS — refresh it before it
      // becomes visible, the container may have moved/resized without a scroll
      onMouseEnter={(withThumb && (() => updateThumb())) || undefined}
    >
      {resolvedChildren()}
    </div>
  );
}
