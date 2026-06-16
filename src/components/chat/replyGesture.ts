import { createProgressRing, ProgressRingHandle } from '@/components/progressRing';
import SetTransition from '@/components/singleTransition';
import Icon from '@/components/icon';
import getVisibleRect from '@/helpers/dom/getVisibleRect';
import { cancelContextMenuOpening } from '@/helpers/dom/attachContextMenuListener';
import cancelEvent from '@/helpers/dom/cancelEvent';
import ListenerSetter from '@/helpers/listenerSetter';
import { fastRaf } from '@/helpers/schedulers';
import { isTruthy } from '../../helpers/isTruthy';

const CLASS_NAME = 'is-gesturing-reply';

// bubble-travel geometry in px: { max translation, reply trigger }. touch mirrors
// Android's dp(80)/dp(50) and tracks the finger 1:1; the trackpad path is tighter
// and pairs with DAMPING (its raw wheel deltas are pre-scaled).
type Geometry = { max: number, reply: number };
const TOUCH_GEOMETRY: Geometry = { max: 80, reply: 50 };
const TRACKPAD_GEOMETRY: Geometry = { max: 64, reply: 48 };
// once armed, stay armed until dropping below reply*this — hysteresis so hovering
// right at the threshold doesn't re-fire the haptic (matches tdesktop's 0.95).
const DISARM_FACTOR = .95;

const HORIZONTAL_LOCK = 8; // px of horizontal travel before engaging
const VERTICAL_COMMIT = 16; // px of vertical travel that locks out replying
// trackpad wheel deltas are high-res and accumulate fast; damp them so the
// bubble follows at a fraction of finger travel and replying needs a deliberate
// swipe rather than a flick (tdesktop's kSwipeSlow).
const DAMPING = 0.3;

// Swipe-to-reply controller shared by the touch SwipeHandler path and the
// Electron trackpad-gesture path. It renders the bubble drag + reply ring and
// (via attachTrackpad) owns the trackpad wheel/gesture plumbing; validating the
// target bubble and firing the actual reply is the caller's job.
export default class ReplyGesture {
  private ring: ProgressRingHandle;
  private icon: HTMLElement;
  private target: HTMLElement;
  private swipeAvatar: HTMLElement | undefined;
  private shouldReply = false;
  private geometry: Geometry = TRACKPAD_GEOMETRY;

  private listenerSetter = new ListenerSetter();
  private trackpadCleanup: (() => void) | undefined;

  constructor(private onReply: (target: HTMLElement) => void, private onArm?: () => void) {}

  public get active() {
    return !!this.target;
  }

  public start(target: HTMLElement, mode: 'touch' | 'trackpad' = 'trackpad') {
    this.target = target;
    this.swipeAvatar = undefined;
    this.geometry = mode === 'touch' ? TOUCH_GEOMETRY : TRACKPAD_GEOMETRY;

    try {
      const avatar = target.parentElement!.querySelector('.bubbles-group-avatar') as HTMLElement;
      if (avatar && getVisibleRect(avatar, target)) {
        this.swipeAvatar = avatar;
      }
    } catch (err) {}

    [target, this.swipeAvatar].filter(isTruthy).forEach((element) => {
      SetTransition({
        element,
        className: CLASS_NAME,
        forwards: true,
        duration: 250,
      });
      void element.offsetLeft; // reflow
    });

    if (!this.icon) {
      this.icon = Icon('reply_filled', 'bubble-gesture-reply-icon');
      this.ring = createProgressRing({
        size: 38, // = --message-beside-button-size (2.375rem)
        strokeWidth: 2,
        stroke: 'white',
        strokeOpacity: 1,
        class: 'bubble-gesture-reply-ring',
      });
      this.icon.append(this.ring.element);
    } else {
      this.icon.classList.remove('is-visible');
      this.icon.style.opacity = '';
      this.ring.setProgress(0);
    }

    // ! not the bubble itself
    const host = target.querySelector<HTMLElement>('.bubble-content-wrapper') ?? target;
    host.append(this.icon);
  }

  public move(xDiff: number) {
    const { max, reply } = this.geometry;
    const shouldReply = xDiff >= (this.shouldReply ? reply * DISARM_FACTOR : reply);
    if (shouldReply && !this.shouldReply) this.onArm?.(); // fire once, on arming
    this.shouldReply = shouldReply;
    this.icon.classList.toggle('is-visible', this.shouldReply);

    const progress = Math.min(1, Math.max(0, xDiff) / reply);
    this.icon.style.opacity = '' + progress;
    this.ring.setProgress(progress);

    const transform = `translateX(${-Math.max(0, Math.min(max, xDiff))}px)`;
    this.target.style.transform = transform;
    if (this.swipeAvatar) {
      this.swipeAvatar.style.transform = transform;
    }

    cancelContextMenuOpening();
  }

  public end() {
    const _target = this.target;
    if (!_target) return;

    const _swipeAvatar = this.swipeAvatar;
    this.target = (this.swipeAvatar = undefined)!;

    const onTransitionEnd = () => {
      if (_target.contains(this.icon)) {
        this.icon.classList.remove('is-visible');
        this.icon.remove();
      }
    };

    [_target, _swipeAvatar].filter(isTruthy).forEach((element, idx) => {
      SetTransition({
        element,
        className: CLASS_NAME,
        forwards: false,
        duration: 250,
        onTransitionEnd: idx === 0 ? onTransitionEnd : undefined,
      });
    });

    fastRaf(() => {
      _target.style.transform = '';
      if (_swipeAvatar) {
        _swipeAvatar.style.transform = '';
      }

      // fade out along with the bubble snap-back
      this.icon.style.opacity = '0';

      if (this.shouldReply) {
        this.onReply(_target);
        this.shouldReply = false;
      }
    });
  }

  // Web has no trackpad gesture begin/end events and raw `wheel` is too flaky to
  // delimit a swipe, so on Electron we rely on the native gesture phases
  public attachTrackpad(
    container: HTMLElement,
    verifyTarget: (eventTarget: EventTarget) => Promise<HTMLElement | undefined>,
  ) {
    let gesturing = false;
    let decided = false; // horizontal lock acquired
    let rejected = false; // this gesture can't reply (vertical / rightward / no target)
    let starting = false; // async target verification in flight
    let accX = 0, accY = 0;

    const resetGesture = () => {
      gesturing = decided = rejected = starting = false;
      accX = accY = 0;
    };

    this.trackpadCleanup = electronAPI!.onSwipeGesture((phase) => {
      if (phase === 'begin') {
        resetGesture();
        gesturing = true;
      } else {
        if (this.active) this.end();
        resetGesture();
      }
    });

    this.listenerSetter.add(container)('wheel', (e: WheelEvent) => {
      if (!gesturing || rejected) return;

      accX += e.deltaX;
      accY += e.deltaY;

      if (!decided) {
        if (Math.abs(accY) >= Math.abs(accX)) {
          if (Math.abs(accY) > VERTICAL_COMMIT) rejected = true; // committed to scroll
          return; // let the wheel scroll vertically
        }

        if (Math.abs(accX) < HORIZONTAL_LOCK) return;

        if (accX < 0) { // rightward, leave for back-navigation
          rejected = true;
          return;
        }

        decided = true;
      }

      cancelEvent(e); // stop horizontal page scroll / overscroll back-nav

      if (this.active) {
        this.move(accX * DAMPING);
        return;
      }

      if (starting) return;
      starting = true;
      verifyTarget(e.target!).then((target) => {
        starting = false;
        if (!gesturing) return; // gesture ended while verifying
        if (!target) {
          rejected = true;
          return;
        }

        this.start(target);
        this.move(accX * DAMPING);
      });
    }, { passive: false });
  }

  public destroy() {
    this.trackpadCleanup?.();
    this.listenerSetter.removeAll();
    this.ring?.destroy();
  }
}
