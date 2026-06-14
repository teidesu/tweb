import IS_TOUCH_SUPPORTED from '@environment/touchSupport';
import { logger, LogTypes } from '@lib/logger';
import fastSmoothScroll, { ScrollOptions } from '@helpers/fastSmoothScroll';
import { cancelAnimationByKey } from '@helpers/animation';
import useHeavyAnimationCheck from '@hooks/useHeavyAnimationCheck';
import cancelEvent from '@helpers/dom/cancelEvent';
import { IS_OVERLAY_SCROLL_SUPPORTED } from '@environment/overlayScrollSupport';
import liteMode from '@helpers/liteMode';
import { IS_MOBILE_SAFARI, IS_SAFARI } from '@environment/userAgent';
/*
var el = $0;
var height = 0;
var checkUp = false;

do {
  height += el.scrollHeight;
} while(el = (checkUp ? el.previousElementSibling : el.nextElementSibling));
console.log(height);
*/

/*
Array.from($0.querySelectorAll('.bubble-content')).forEach((_el) => {
  //_el.style.display = '';
  //return;

  let el = _el.parentElement;
  let height = el.scrollHeight;
  let width = el.scrollWidth;
  el.style.width = width + 'px';
  el.style.height = height + 'px';
  _el.style.display = 'none';
});
*/

/* const scrollables: Map<HTMLElement, Scrollable> = new Map();
const scrollsIntersector = new IntersectionObserver((entries) => {
  for(let entry of entries) {
    const scrollable = scrollables.get(entry.target as HTMLElement);

    if(entry.isIntersecting) {
      scrollable.isVisible = true;
    } else {
      scrollable.isVisible = false;

      if(!isInDOM(entry.target)) {
        scrollsIntersector.unobserve(scrollable.container);
        scrollables.delete(scrollable.container);
      }
    }
  }
}); */

const SCROLL_THROTTLE = /* IS_ANDROID ? 200 :  */24;

// Aligns the thumb overlay to the scroller's padding box (not border box —
// transparent border insets like the chat topbar/input reservation must keep
// confining the track). The two elements are siblings, so they share a
// containing block and offset* coordinates line up. Returns the new geometry
// cache key.
export function syncThumbContainerGeometry(container: HTMLElement, thumbContainer: HTMLElement, lastGeometry: string): string {
  const top = container.offsetTop + container.clientTop;
  const left = container.offsetLeft + container.clientLeft;
  const geometry = `${top},${left},${container.clientWidth},${container.clientHeight}`;
  if (geometry !== lastGeometry) {
    const { style } = thumbContainer;
    style.top = top + 'px';
    style.left = left + 'px';
    style.width = container.clientWidth + 'px';
    style.height = container.clientHeight + 'px';
  }

  return geometry;
}

function throttleMeasurement(callback: () => void): number {
  if (!IS_OVERLAY_SCROLL_SUPPORTED()) {
    return requestAnimationFrame(callback);
  }
  return window.setTimeout(callback, SCROLL_THROTTLE);
}

function cancelMeasurement(id: number): void {
  if (!IS_OVERLAY_SCROLL_SUPPORTED()) {
    cancelAnimationFrame(id);
  } else {
    window.clearTimeout(id);
  }
}

export class ScrollableBase {
  protected log: ReturnType<typeof logger>;

  public padding: HTMLElement;
  public splitUp: HTMLElement;
  public onScrollMeasure: number = 0;

  public lastScrollPosition: number = 0;
  public lastScrollDirection: number = 0;

  public onAdditionalScroll: (() => void) | undefined;
  public onScrolledTop: (() => void) | undefined;
  public onScrolledBottom: (() => void) | undefined | null;

  public isHeavyAnimationInProgress = false;
  protected needCheckAfterAnimation = false;

  public checkForTriggers?: () => void;

  public scrollPositionProperty: 'scrollTop' | 'scrollLeft';
  public scrollSizeProperty: 'scrollHeight' | 'scrollWidth';
  public clientSizeProperty: 'clientHeight' | 'clientWidth';
  public offsetSizeProperty: 'offsetHeight' | 'offsetWidth';
  public clientAxis: 'clientY' | 'clientX';

  protected startMousePosition: number;
  protected startScrollPosition: number;

  protected thumb: HTMLElement;
  protected thumbContainer: HTMLElement;
  // Shortens the thumb track at the end edge (px). Needed when part of the
  // padding box is reserved by in-content spacers rather than borders (chat
  // input helper surplus) — the track must not extend behind the overlay.
  public getThumbTrackInsetEnd?: () => number;

  protected removeHeavyAnimationListener: (() => void) | undefined;
  protected addedScrollListener: boolean;

  protected resizeObserver: ResizeObserver | undefined;
  protected mutationObserver: MutationObserver | undefined;

  constructor(
    public el?: HTMLElement,
    logPrefix = '',
    public container: HTMLElement = document.createElement('div')
  ) {
    this.container.classList.add('scrollable');

    this.log = logger('SCROLL' + (logPrefix ? '-' + logPrefix : ''), LogTypes.Error);

    if (el) {
      Array.from(el.children).forEach((c) => this.container.append(c));

      el.append(this.container);
    }

    // this.onScroll();
  }

  public addScrollListener() {
    if (this.addedScrollListener) {
      return;
    }

    this.addedScrollListener = true;
    this.container.addEventListener('scroll', this.onScroll, { passive: true, capture: true });
  }

  public removeScrollListener() {
    if (!this.addedScrollListener) {
      return;
    }

    this.addedScrollListener = false;
    this.container.removeEventListener('scroll', this.onScroll, { capture: true });
  }

  public setListeners() {
    if (this.removeHeavyAnimationListener) {
      return;
    }

    window.addEventListener('resize', this.invalidateMeasurements, { passive: true });
    this.addScrollListener();

    // ResizeObserver covers the container's own box, MutationObserver covers
    // content changes that only affect scrollSize — together they invalidate
    // the measurement caches so scroll frames never have to read layout
    this.resizeObserver = new ResizeObserver(this.invalidateMeasurements);
    this.resizeObserver.observe(this.container);
    this.mutationObserver = new MutationObserver(this.invalidateMeasurements);
    this.mutationObserver.observe(this.container, { childList: true, subtree: true });

    this.removeHeavyAnimationListener = useHeavyAnimationCheck(() => {
      this.isHeavyAnimationInProgress = true;

      if (this.onScrollMeasure) {
        this.cancelMeasure();
        this.needCheckAfterAnimation = true;
      }
    }, () => {
      this.isHeavyAnimationInProgress = false;

      if (this.needCheckAfterAnimation) {
        this.onScroll();
        this.needCheckAfterAnimation = false;
      }
    });
  }

  public removeListeners() {
    if (!this.removeHeavyAnimationListener) {
      return;
    }

    window.removeEventListener('resize', this.invalidateMeasurements);
    this.resizeObserver!.disconnect();
    this.resizeObserver = undefined;
    this.mutationObserver!.disconnect();
    this.mutationObserver = undefined;
    if (this.thumb) {
      this.thumb.removeEventListener('mousedown', this.onMouseDown);
      this.container.removeEventListener('mouseenter', this.onContainerMouseEnter);
      window.removeEventListener('mousemove', this.onMouseMove);
      window.removeEventListener('mouseup', this.onMouseUp);
    }
    this.removeScrollListener();

    this.removeHeavyAnimationListener();
    this.removeHeavyAnimationListener = undefined;
  }

  public destroy() {
    this.removeListeners();
    this.thumbContainer?.remove();
    this.onAdditionalScroll = undefined;
    this.onScrolledTop = undefined;
    this.onScrolledBottom = undefined;
  }

  public prepend(...elements: (string | Node)[]) {
    const prependTo = this.splitUp || this.padding || this.container;
    prependTo.prepend(...elements);
    this.onSizeChange();
  }

  public append(...elements: (string | Node)[]) {
    (this.splitUp || this.padding || this.container).append(...elements);
    this.onSizeChange();
  }

  public scrollIntoViewNew(options: Omit<ScrollOptions, 'container'>) {
    // return Promise.resolve();
    // this.removeListeners();
    const promise = fastSmoothScroll({
      ...options,
      container: this.container,
    });/* .finally(() => {
      this.setListeners();
    }); */

    // let user input interrupt the programmatic scroll midway
    const cancel = () => cancelAnimationByKey(this.container);
    const events = ['wheel', 'touchmove'] as const;
    events.forEach((e) => this.container.addEventListener(e, cancel, { passive: true }));
    promise.finally(() => {
      events.forEach((e) => this.container.removeEventListener(e, cancel));
    });

    return promise;
  }

  public onScroll = () => {
    // if(this.debug) {
    // this.log('onScroll call', this.onScrollMeasure);
    // }

    // return;

    if (this.isHeavyAnimationInProgress) {
      this.cancelMeasure();
      this.needCheckAfterAnimation = true;
      return;
    }

    // if(this.onScrollMeasure || ((this.scrollLocked || (!this.onScrolledTop && !this.onScrolledBottom)) && !this.splitUp && !this.onAdditionalScroll)) return;
    if ((!this.onScrolledTop && !this.onScrolledBottom) && !this.splitUp && !this.onAdditionalScroll && !this.thumb) return;

    // cache scroll position to avoid forced reflows if the layout is dirty in the throttled measure
    this.capturedScrollPosition = this.scrollPosition;

    if (this.onScrollMeasure) return;
    this.onScrollMeasure = throttleMeasurement(() => {
      this.onScrollMeasure = 0;

      if (this.sizesDirty) {
        this.refreshMeasurements();
      }

      const scrollPosition = this.capturedScrollPosition;
      this.lastScrollDirection = this.lastScrollPosition === scrollPosition ? 0 : (this.lastScrollPosition < scrollPosition ? 1 : -1); // * 1 - bottom, -1 - top
      this.lastScrollPosition = scrollPosition;

      this.updateThumb(scrollPosition, false);

      // lastScrollDirection check is useless here, every callback should decide on its own
      if (this.onAdditionalScroll/*  && this.lastScrollDirection !== 0 */) {
        this.onAdditionalScroll();
      }

      if (this.checkForTriggers) {
        this.checkForTriggers();
      }
    });
  };

  protected lastThumbGeometry = '';
  protected cachedScrollSize = -1;
  protected cachedClientSize = -1;
  protected sizesDirty = true;
  protected capturedScrollPosition = 0;

  protected refreshMeasurements() {
    // ! all layout reads are here and only run when something invalidated,
    // ! to avoid accidental reflows from re-reading height/width
    this.sizesDirty = false;
    this.cachedScrollSize = this.container[this.scrollSizeProperty];
    this.cachedClientSize = this.container[this.clientSizeProperty];
    if (this.thumb && this.thumbContainer.parentElement) {
      this.lastThumbGeometry = syncThumbContainerGeometry(this.container, this.thumbContainer, this.lastThumbGeometry);
    }
  }

  public invalidateMeasurements = () => {
    this.sizesDirty = true;
    this.onScroll();
  };

  // The thumb overlays the scroller from outside, as a sibling: any descendant
  // (even position: sticky) rides the macOS rubber-band overscroll bounce
  // together with the content, while a sibling stays pinned. The container may
  // not be in the DOM yet (callers often append it themselves), so attachment
  // is re-asserted lazily — on every thumb update and on hover, the only
  // moments the thumb is visible.
  protected ensureThumbAttached() {
    if (!this.container.parentElement) {
      this.thumbContainer.remove();
      this.lastThumbGeometry = '';
      return false;
    }

    // adjacency (not mere presence) is required by the :hover sibling selector
    if (this.container.nextElementSibling !== this.thumbContainer) {
      this.container.after(this.thumbContainer);
      // an attach/move means the container's offsets may have changed too
      this.sizesDirty = true;
    }

    return true;
  }

  protected onContainerMouseEnter = () => {
    this.updateThumb();
  };

  // fresh = re-read layout: the default for external callers (they signal a
  // change we can't observe synchronously); scroll measures pass false and
  // consume the caches
  public updateThumb(scrollPosition = this.scrollPosition, fresh = true) {
    if (IS_OVERLAY_SCROLL_SUPPORTED() || !this.thumb) {
      return;
    }

    if (!this.ensureThumbAttached()) {
      return;
    }

    // a live scroll mid-settle takes over: drop the transition so the thumb
    // tracks the scroll position without lag
    this.thumbTransitionCleanup?.();

    if (fresh || this.sizesDirty) {
      this.refreshMeasurements();
    }

    const scrollSize = this.cachedScrollSize;
    const clientSize = this.cachedClientSize;
    // Safari reports out-of-bounds positions during rubber-band overscroll
    scrollPosition = Math.max(0, Math.min(scrollPosition, scrollSize - clientSize));
    const trackSize = clientSize - (this.getThumbTrackInsetEnd?.() ?? 0);
    const divider = scrollSize / trackSize / 0.75;
    const thumbSize = Math.max(20, trackSize / divider);
    const value = scrollPosition / (scrollSize - clientSize) * trackSize;
    // const b = (scrollPosition + clientSize) / scrollSize;
    const b = scrollPosition / (scrollSize - clientSize);
    const maxValue = trackSize - thumbSize;
    if (clientSize < scrollSize) {
      this.thumb.style.height = thumbSize + 'px';
      // this.thumb.style.top = `${Math.min(maxValue, value - thumbSize * b)}px`;
      this.thumb.style.transform = `translateY(${Math.min(maxValue, value - thumbSize * b)}px)`;
    } else {
      this.thumb.style.height = '0px';
    }
  }

  protected thumbTransitionCleanup?: () => void;

  // Repositions the thumb with a transform/height settle instead of a snap —
  // for one-shot track changes (input helper toggling) that accompany an
  // animated content shift. Regular scroll updates stay transition-free so the
  // thumb never lags behind live scrolling.
  public updateThumbAnimated() {
    const thumb = this.thumb;
    if (IS_OVERLAY_SCROLL_SUPPORTED() || !thumb || !liteMode.isAvailable('animations')) {
      this.updateThumb();
      return;
    }

    this.thumbTransitionCleanup?.();
    // keep the hover opacity transition from _scrollable.scss alive while the inline override is active
    thumb.style.transition = 'transform var(--transition-snappy), height var(--transition-snappy), opacity .1s ease-in-out';
    // the cleanup isn't registered yet, so updateThumb's cancel is a no-op here
    this.updateThumb();

    const onTransitionEnd = (e: TransitionEvent) => {
      if (e.target === thumb && e.propertyName === 'transform') cleanup();
    };
    const timeout = setTimeout(() => cleanup(), 400);
    thumb.addEventListener('transitionend', onTransitionEnd);
    const cleanup = this.thumbTransitionCleanup = () => {
      this.thumbTransitionCleanup = undefined;
      clearTimeout(timeout);
      thumb.removeEventListener('transitionend', onTransitionEnd);
      thumb.style.transition = '';
    };
  }

  public cancelMeasure() {
    if (this.onScrollMeasure) {
      cancelMeasurement(this.onScrollMeasure);
      this.onScrollMeasure = 0;
    }
  }

  protected onMouseMove = (e: MouseEvent) => {
    cancelEvent(e);

    // caches are fresh here: the thumb is only draggable while visible, and
    // visibility implies a recent updateThumb
    const contentHeight = this.cachedScrollSize;
    const viewportHeight = this.cachedClientSize;
    const trackHeight = viewportHeight - (this.getThumbTrackInsetEnd?.() ?? 0);
    const scrollbarSize = this.thumb.offsetHeight;
    const maxScrollTop = contentHeight - viewportHeight;

    const maxScrollbarOffset = trackHeight - scrollbarSize;
    const deltaY = e[this.clientAxis] - this.startMousePosition;
    const scrollAmount = (deltaY / maxScrollbarOffset) * maxScrollTop;
    const newScrollTop = this.startScrollPosition + scrollAmount;

    this.scrollPosition = newScrollTop;
  };

  protected onMouseDown = (e: MouseEvent) => {
    cancelEvent(e);
    this.startMousePosition = e[this.clientAxis];
    this.startScrollPosition = this.scrollPosition;
    this.thumb.classList.add('is-focused');

    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp, { once: true });
  };

  protected onMouseUp = (e: MouseEvent) => {
    window.removeEventListener('mousemove', this.onMouseMove);
    this.thumb.classList.remove('is-focused');
  };

  public onSizeChange() {
    this.invalidateMeasurements();
  }

  public getDistanceToEnd() {
    // clientSize, not offsetSize, to exclude borders
    return this.scrollSize - Math.round(this.scrollPosition + this.clientSize);
  }

  get isScrolledToEnd() {
    return this.getDistanceToEnd() <= 1;
  }

  get scrollPosition() {
    return this.container[this.scrollPositionProperty];
  }

  set scrollPosition(value: number) {
    this.container[this.scrollPositionProperty] = value;
  }

  get scrollSize() {
    return this.container[this.scrollSizeProperty];
  }

  get clientSize() {
    return this.container[this.clientSizeProperty];
  }

  get offsetSize() {
    return this.container[this.offsetSizeProperty];
  }

  get firstElementChild() {
    return this.container.firstElementChild;
  }

  public setScrollPositionSilently(value: number) {
    this.lastScrollPosition = value;
    // a pending measure must not consume a position captured before the jump
    this.capturedScrollPosition = value;
    this.ignoreNextScrollEvent();

    this.scrollPosition = value;
  }

  public ignoreNextScrollEvent() {
    if (this.removeHeavyAnimationListener) {
      this.removeScrollListener();
      this.container.addEventListener('scroll', (e) => {
        cancelEvent(e);
        this.addScrollListener();
      }, { capture: true, passive: false, once: true });
    }
  }

  public replaceChildren(...args: (string | Node)[]) {
    this.container.replaceChildren(...args);
  }
}

export type SliceSides = 'top' | 'bottom';
export type SliceSidesContainer = {[k in SliceSides]: boolean};

export default class Scrollable extends ScrollableBase {
  public loadedAll: SliceSidesContainer = { top: true, bottom: false };

  constructor(
    el?: HTMLElement,
    logPrefix = '',
    public onScrollOffset = 300,
    withPaddingContainer?: boolean,
    container?: HTMLElement
  ) {
    super(el, logPrefix, container);

    // withPaddingContainer = true;
    // if(withPaddingContainer) {
    //   this.padding = document.createElement('div');
    //   this.padding.classList.add('scrollable-padding');
    //   this.padding.append(...Array.from(this.container.children));
    //   this.container.append(this.padding);
    // }

    this.scrollPositionProperty = 'scrollTop';
    this.scrollSizeProperty = 'scrollHeight';
    this.clientSizeProperty = 'clientHeight';
    this.offsetSizeProperty = 'offsetHeight';
    this.clientAxis = 'clientY';

    if (!IS_OVERLAY_SCROLL_SUPPORTED()) {
      this.thumbContainer = document.createElement('div');
      this.thumbContainer.classList.add('scrollable-thumb-container');
      this.thumb = document.createElement('div');
      this.thumb.classList.add('scrollable-thumb');
      this.thumbContainer.append(this.thumb);

      this.thumb.addEventListener('mousedown', this.onMouseDown);
      this.container.addEventListener('mouseenter', this.onContainerMouseEnter);
      this.ensureThumbAttached();
    }

    this.container.classList.add('scrollable-y');
    if (IS_SAFARI && !IS_MOBILE_SAFARI) {
      this.container.classList.add('no-scrollbar');
    }
    this.setListeners();
  }

  public attachBorderListeners(setClassOn = this.container) {
    const cb = this.onAdditionalScroll;
    // runs from the scroll measure: lastScrollPosition and the caches were
    // refreshed right before
    this.onAdditionalScroll = () => {
      cb?.();
      setClassOn.classList.toggle('scrolled-start', !this.lastScrollPosition);
      setClassOn.classList.toggle('scrolled-end', this.cachedScrollSize - Math.round(this.lastScrollPosition + this.cachedClientSize) <= 1);
    };

    setClassOn.classList.add('scrolled-start', 'scrolled-end', 'scrollable-y-bordered');
  }

  public setVirtualContainer(el?: HTMLElement) {
    this.splitUp = el!;
    this.log('setVirtualContainer:', el, this);
  }

  public checkForTriggers = () => {
    if ((!this.onScrolledTop && !this.onScrolledBottom)) return;

    if (this.isHeavyAnimationInProgress) {
      this.onScroll();
      return;
    }

    if (this.sizesDirty) {
      this.refreshMeasurements();
    }

    // lastScrollPosition is in sync: the scroll measure updates it right
    // before calling here, external callers (force-checking after a content
    // load) come after a measure or a silent set
    const scrollSize = this.cachedScrollSize;
    const scrollPosition = this.lastScrollPosition;
    if (!scrollSize) { // незачем вызывать триггеры если блок пустой или не виден
      return;
    }

    const maxScrollPosition = scrollSize - this.cachedClientSize;

    // this.log('checkForTriggers:', scrollTop, maxScrollTop);

    if (this.onScrolledTop && scrollPosition <= this.onScrollOffset && this.lastScrollDirection <= 0/* && direction === -1 */) {
      this.onScrolledTop();
    }

    if (this.onScrolledBottom && (maxScrollPosition - scrollPosition) <= this.onScrollOffset && this.lastScrollDirection >= 0/* && direction === 1 */) {
      this.onScrolledBottom();
    }
  };
}

export class ScrollableX extends ScrollableBase {
  constructor(el: HTMLElement, logPrefix = '', public onScrollOffset = 300, public splitCount = 15, public container: HTMLElement = document.createElement('div')) {
    super(el, logPrefix, container);

    this.container.classList.add('scrollable-x');

    if (!IS_TOUCH_SUPPORTED) {
      const scrollHorizontally = (e: WheelEvent) => {
        e.stopPropagation();
        if (!e.deltaX && this.container.scrollWidth > this.container.clientWidth) {
          this.container.scrollLeft += e.deltaY / 4;
          cancelEvent(e);
        }
      };

      this.container.addEventListener('wheel', scrollHorizontally, { passive: false });
    }

    this.scrollPositionProperty = 'scrollLeft';
    this.scrollSizeProperty = 'scrollWidth';
    this.clientSizeProperty = 'clientWidth';
    this.offsetSizeProperty = 'offsetWidth';
  }
}
