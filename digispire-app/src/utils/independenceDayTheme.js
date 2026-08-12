/**
 * Independence Day Festive Theme Utility
 * Automatically enables the Indian Independence Day tri-color UI theme
 * during Independence Day season (August 12 - August 20), or when forced ON.
 */

// Set to true to test/force the theme regardless of date, or false to disable.
// If null, it automatically uses the date-range logic (August 12 - August 20).
const FORCE_FESTIVE_THEME = true;

/**
 * Checks if the Independence Day theme should be currently active.
 * @returns {boolean}
 */
export function isIndependenceDayActive() {
  if (FORCE_FESTIVE_THEME !== null) {
    return FORCE_FESTIVE_THEME;
  }

  const now = new Date();
  const month = now.getMonth(); // 0-indexed: 7 = August
  const date = now.getDate();

  // Active from August 12th to August 20th
  return month === 7 && date >= 12 && date <= 20;
}

/**
 * Fire Independence Day Confetti Custom Event
 */
export function triggerTriColorCelebration() {
  window.dispatchEvent(new CustomEvent('trigger-tricolor-confetti'));
}
