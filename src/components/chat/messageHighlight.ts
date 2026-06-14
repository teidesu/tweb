import liteMode from '@helpers/liteMode';

// Single source of truth for the message-highlight tint (the `--message-highlighting-color`
// overlay) on a bubble. Replaces the old dueling `.is-highlighted` / `.is-selected` CSS
// animations on `::after`, which fought each other (e.g. reply-jump highlight + immediate
// selection). Two inputs feed one lazily-created overlay element:
//   - selection: persistent, snaps in, fades out on deselect
//   - pulse:     transient reply/jump flash, holds briefly then fades
// Precedence: selection always wins — a pulse on a selected bubble is a no-op, and selecting
// mid-pulse cancels the pulse and pins the overlay on.
//
// The overlay is a real DOM node (WAAPI can't animate `::after` cross-browser) created on
// demand and removed once neither input needs it, so idle bubbles carry no extra node.

const HIGHLIGHT_DURATION = 2000;
const FADE_OUT_DURATION = 120;

type State = {
  overlay?: HTMLElement;
  selected: boolean;
  anim?: Animation;
  timeout?: number;
};

const states = new WeakMap<HTMLElement, State>();

// only one transient pulse may be visible at a time — a new jump (reply, cmd+up/down, search)
// instantly clears the previous one so two messages never look highlighted at once
let activePulseHost: HTMLElement | undefined;

function getState(host: HTMLElement) {
  let state = states.get(host);
  if (!state) {
    state = { selected: false };
    states.set(host, state);
  }
  return state;
}

function ensureOverlay(host: HTMLElement, state: State) {
  if (!state.overlay) {
    const overlay = document.createElement('div');
    overlay.className = 'bubble-highlight';
    host.append(overlay);
    state.overlay = overlay;
  }
  return state.overlay;
}

function clearAnim(state: State) {
  state.anim?.cancel();
  state.anim = undefined;
  if (state.timeout !== undefined) {
    clearTimeout(state.timeout);
    state.timeout = undefined;
  }
}

// drop the overlay once it's neither selected nor mid-pulse
function maybeDestroy(host: HTMLElement, state: State) {
  if (state.selected || state.anim || state.timeout !== undefined) return;
  state.overlay?.remove();
  states.delete(host);
}

export function setMessageSelected(host: HTMLElement, selected: boolean, animate = true) {
  const state = getState(host);
  state.selected = selected;
  clearAnim(state);

  if (selected) {
    ensureOverlay(host, state).style.opacity = '1'; // snap in
    return;
  }

  if (!state.overlay) return;

  if (animate && liteMode.isAvailable('animations')) {
    const overlay = state.overlay;
    const anim = overlay.animate({ opacity: [1, 0] }, { duration: FADE_OUT_DURATION, easing: 'linear', fill: 'forwards' });
    state.anim = anim;
    anim.onfinish = () => {
      if (state.anim === anim) state.anim = undefined;
      maybeDestroy(host, state);
    };
  } else {
    maybeDestroy(host, state);
  }
}

function clearActivePulse(except?: HTMLElement) {
  if (!activePulseHost || activePulseHost === except) return;
  const prev = states.get(activePulseHost);
  if (prev) {
    clearAnim(prev);
    maybeDestroy(activePulseHost, prev);
  }
  activePulseHost = undefined;
}

// immediately drop the active transient highlight (e.g. cancelling a cmd+up reply)
export function cancelMessageHighlight() {
  clearActivePulse();
}

export function pulseMessageHighlight(host: HTMLElement) {
  const state = getState(host);
  if (state.selected) return; // selection wins
  clearActivePulse(host); // a new jump cancels the previous highlight
  clearAnim(state);
  activePulseHost = host;

  const overlay = ensureOverlay(host, state);

  const done = () => {
    if (activePulseHost === host) activePulseHost = undefined;
    maybeDestroy(host, state);
  };

  if (!liteMode.isAvailable('animations')) {
    overlay.style.opacity = '1';
    state.timeout = window.setTimeout(() => {
      state.timeout = undefined;
      done();
    }, HIGHLIGHT_DURATION);
    return;
  }

  // snap to full, hold briefly, then fade out smoothly
  const anim = overlay.animate(
    [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0, offset: 1 }],
    { duration: HIGHLIGHT_DURATION, easing: 'linear', fill: 'forwards' }
  );
  state.anim = anim;
  anim.onfinish = () => {
    if (state.anim === anim) state.anim = undefined;
    done();
  };
}
