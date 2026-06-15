//! Subtle trackpad haptic, fired when the swipe-to-reply gesture arms (crosses
//! the reply threshold) so a release would send the reply.

use objc2_app_kit::{
  NSHapticFeedbackManager, NSHapticFeedbackPattern, NSHapticFeedbackPerformanceTime,
  NSHapticFeedbackPerformer,
};

#[napi]
pub fn perform_haptic_feedback() {
  let performer = NSHapticFeedbackManager::defaultPerformer();
  performer.performFeedbackPattern_performanceTime(
    NSHapticFeedbackPattern::Alignment, // the lightest pattern
    NSHapticFeedbackPerformanceTime::Now,
  );
}
