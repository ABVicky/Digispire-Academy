import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export const triggerHaptic = async (type = 'light') => {
  // 1. Direct Capacitor Plugin via global or imported instance
  try {
    const hapticsPlugin = (typeof window !== 'undefined' && window.Capacitor?.Plugins?.Haptics) || Haptics;
    if (hapticsPlugin) {
      if (type === 'light') {
        await hapticsPlugin.impact({ style: ImpactStyle?.Light || 'LIGHT' });
        return;
      } else if (type === 'medium') {
        await hapticsPlugin.impact({ style: ImpactStyle?.Medium || 'MEDIUM' });
        return;
      } else if (type === 'heavy') {
        await hapticsPlugin.impact({ style: ImpactStyle?.Heavy || 'HEAVY' });
        return;
      } else if (type === 'success') {
        await hapticsPlugin.notification({ type: NotificationType?.Success || 'SUCCESS' });
        return;
      } else if (type === 'warning') {
        await hapticsPlugin.notification({ type: NotificationType?.Warning || 'WARNING' });
        return;
      } else if (type === 'error') {
        await hapticsPlugin.notification({ type: NotificationType?.Error || 'ERROR' });
        return;
      } else {
        await hapticsPlugin.vibrate({ duration: 30 });
        return;
      }
    }
  } catch {
    // Continue to Web Vibration API
  }

  // 2. Web Vibration API Fallback
  if (typeof window !== 'undefined' && window.navigator && typeof window.navigator.vibrate === 'function') {
    try {
      switch (type) {
        case 'light':
          window.navigator.vibrate(15);
          break;
        case 'medium':
          window.navigator.vibrate(25);
          break;
        case 'heavy':
          window.navigator.vibrate(45);
          break;
        case 'success':
          window.navigator.vibrate([20, 40, 30]);
          break;
        case 'error':
          window.navigator.vibrate([50, 70, 50]);
          break;
        default:
          window.navigator.vibrate(20);
      }
    } catch (e) {
      console.warn('Haptic vibration fallback error:', e);
    }
  }
};

