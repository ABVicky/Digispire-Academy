/**
 * Mobile Haptic/Vibration Feedback Utility
 * Uses the Web Vibration API with safe fallbacks for unsupported devices/browsers.
 */
export const triggerHaptic = (type = 'light') => {
  if (typeof window !== 'undefined' && window.navigator && typeof window.navigator.vibrate === 'function') {
    try {
      switch (type) {
        case 'light':
          // Subtle touch feedback (e.g. keypress, switch toggle)
          window.navigator.vibrate(12);
          break;
        case 'medium':
          // Standard button click feedback
          window.navigator.vibrate(20);
          break;
        case 'heavy':
          // Impact feedback (e.g. deletion action)
          window.navigator.vibrate(35);
          break;
        case 'success':
          // Positive feedback sequence (e.g. check-in success, save confirmation)
          window.navigator.vibrate([15, 30, 20]);
          break;
        case 'error':
          // Negative feedback warning sequence (e.g. form error, check-in failure)
          window.navigator.vibrate([45, 60, 45]);
          break;
        default:
          window.navigator.vibrate(15);
      }
    } catch (e) {
      console.warn('Haptic vibration failed:', e);
    }
  }
};
