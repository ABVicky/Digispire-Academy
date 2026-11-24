import { lazy } from 'react';

const RELOAD_KEY = 'ds_page_reload_at';
const RELOAD_COOLDOWN_MS = 30 * 1000;

// Reload at most once per cooldown so a file that stays missing can't loop.
function reloadOnce() {
  if (!navigator.onLine) return false;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0;
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/**
 * React.lazy for pages. A page file can fail to download on a weak connection,
 * or no longer exist after a new deploy. React.lazy keeps that failure for good,
 * so reload once to fetch the current build; otherwise let ErrorBoundary show it.
 */
export function lazyPage(load) {
  return lazy(async () => {
    try {
      return await load();
    } catch (err) {
      if (reloadOnce()) return new Promise(() => {}); // keep the loader up until the reload
      throw err;
    }
  });
}
