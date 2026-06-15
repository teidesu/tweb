#[macro_use]
extern crate napi_derive;

#[cfg(target_os = "macos")]
mod haptics;
#[cfg(target_os = "macos")]
mod scroll_monitor;

#[cfg(target_os = "macos")]
pub use haptics::*;
#[cfg(target_os = "macos")]
pub use scroll_monitor::*;

// non-macOS: trackpad gesture phases / haptics aren't available, expose no-op
// stubs so the addon stays loadable (the renderer only wires this up on darwin).
#[cfg(not(target_os = "macos"))]
mod stub {
  use napi::bindgen_prelude::Unknown;
  use napi::threadsafe_function::ThreadsafeFunction;
  use napi::{Result, Status};

  #[napi(ts_args_type = "callback: (phase: 'begin' | 'end') => void")]
  pub fn start_scroll_monitor(
    _callback: ThreadsafeFunction<String, Unknown<'static>, String, Status, false>,
  ) -> Result<()> {
    Ok(())
  }

  #[napi]
  pub fn stop_scroll_monitor() {}

  #[napi]
  pub fn perform_haptic_feedback() {}
}

#[cfg(not(target_os = "macos"))]
pub use stub::*;
