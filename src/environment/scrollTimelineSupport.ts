// CSS scroll-driven animations (animation-timeline: scroll()) — lets the custom
// scrollbar thumb track scrolling on the compositor instead of via main-thread JS.
const IS_SCROLL_TIMELINE_SUPPORTED = typeof(CSS) !== 'undefined' &&
  !!CSS.supports?.('animation-timeline', 'scroll()');

export default IS_SCROLL_TIMELINE_SUPPORTED;
