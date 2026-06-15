//! Raw trackpad gesture phases for swipe-to-reply.
//!
//! Chromium's wheel-phase latching swallows the finger-lift `gestureScrollEnd`
//! on macOS, so the reply only commits after kinetic scrolling settles. An
//! `NSEvent` local monitor sees the untouched trackpad event, where
//! `NSEvent.phase` reports `Began` on touch-down and `Ended` the instant the
//! fingers lift — *before* any momentum. We forward those as `begin`/`end` so
//! the gesture commits at finger-lift. The monitor is passthrough (it returns
//! the event unchanged), so scrolling is unaffected.

use std::cell::RefCell;
use std::ptr::NonNull;

use block2::RcBlock;
use napi::bindgen_prelude::Unknown;
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi::{Result, Status};

use objc2::rc::Retained;
use objc2::runtime::AnyObject;
use objc2_app_kit::{NSEvent, NSEventMask, NSEventPhase};

// CalleeHandled = false → the JS callback is invoked value-only `(phase)`, not
// error-first `(err, phase)` (napi's default), and `call` takes the value directly.
type SwipeCallback = ThreadsafeFunction<String, Unknown<'static>, String, Status, false>;

thread_local! {
  // the opaque monitor token, kept so we can remove it. main-thread only.
  static MONITOR: RefCell<Option<Retained<AnyObject>>> = const { RefCell::new(None) };
}

#[napi(ts_args_type = "callback: (phase: 'begin' | 'end') => void")]
pub fn start_scroll_monitor(callback: SwipeCallback) -> Result<()> {
  stop_scroll_monitor();

  let handler = RcBlock::new(move |event: NonNull<NSEvent>| -> *mut NSEvent {
    let phase = unsafe { event.as_ref().phase() };
    if phase.0 & NSEventPhase::Began.0 != 0 {
      callback.call("begin".to_owned(), ThreadsafeFunctionCallMode::NonBlocking);
    } else if phase.0 & (NSEventPhase::Ended.0 | NSEventPhase::Cancelled.0) != 0 {
      callback.call("end".to_owned(), ThreadsafeFunctionCallMode::NonBlocking);
    }
    event.as_ptr() // passthrough — never swallow the scroll
  });

  let token = unsafe {
    NSEvent::addLocalMonitorForEventsMatchingMask_handler(NSEventMask::ScrollWheel, &handler)
  };
  MONITOR.with(|m| *m.borrow_mut() = token);
  Ok(())
}

#[napi]
pub fn stop_scroll_monitor() {
  MONITOR.with(|m| {
    if let Some(token) = m.borrow_mut().take() {
      unsafe { NSEvent::removeMonitor(&token) };
    }
  });
}
