/** True inside the Capacitor Android app (which loads this same website). */
export function isNativeApp() {
  try {
    return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

/** Email features are web-only: hidden in the Android app. */
export const emailFeaturesEnabled = () => !isNativeApp();
