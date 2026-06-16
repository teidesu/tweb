import { createMemo, createRoot } from 'solid-js';
import { CHROMIUM_VERSION, IS_CHROMIUM, IS_MOBILE, IS_MOBILE_SAFARI, IS_SAFARI } from '@environment/userAgent';
import scrollbarWidth from '@helpers/dom/scrollbarWidth';

export const USE_NATIVE_SCROLL = /* IS_APPLE ||  */IS_MOBILE/*  || true */;

const STATIC_OVERLAY_SCROLL = IS_MOBILE ||
  (!IS_CHROMIUM && (!IS_SAFARI || IS_MOBILE_SAFARI)) ||
  CHROMIUM_VERSION! < 113 ||
  CHROMIUM_VERSION! >= 145;

// app-lifetime singletons — owned by a never-disposed root to keep Solid from warning
export const IS_OVERLAY_SCROLL_SUPPORTED = createRoot(() =>
  createMemo(() => STATIC_OVERLAY_SCROLL && scrollbarWidth() === 0));
export const USE_CUSTOM_SCROLL = createRoot(() =>
  createMemo(() => !USE_NATIVE_SCROLL && !IS_OVERLAY_SCROLL_SUPPORTED()));
