/**
 * DIGISPIRE System & Push Notification Engine
 * Handles Native Android Local Notifications, Web Notifications API,
 * Service Worker Push, audio chime synthesis, and native Haptic feedback.
 */

// Native Haptics Trigger (Capacitor + Web fallback)
export async function triggerHaptic(type = 'medium') {
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
    if (Haptics) {
      if (type === 'light') await Haptics.impact({ style: ImpactStyle.Light });
      else if (type === 'medium') await Haptics.impact({ style: ImpactStyle.Medium });
      else if (type === 'heavy') await Haptics.impact({ style: ImpactStyle.Heavy });
      else if (type === 'success') await Haptics.notification({ type: NotificationType.Success });
      else if (type === 'warning') await Haptics.notification({ type: NotificationType.Warning });
      else if (type === 'error') await Haptics.notification({ type: NotificationType.Error });
      return;
    }
  } catch {
    // Fall back to Web Vibration API
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (type === 'light') navigator.vibrate(40);
      else if (type === 'heavy' || type === 'error') navigator.vibrate([100, 50, 100]);
      else navigator.vibrate(80);
    }
  }
}

// Web Audio API Synthesizer for smooth notification chime
export function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Tone 1 (C5 - 523.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tone 2 (G5 - 783.99 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(783.99, now + 0.12);
    gain2.gain.setValueAtTime(0.15, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.55);
  } catch (err) {
    console.warn('Audio chime synthesis unavailable:', err);
  }
}

// Request Notification Permission (Native Android + Web)
export async function requestNotificationPermission() {
  // 1. Try Native Capacitor Local Notifications
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    if (LocalNotifications) {
      const status = await LocalNotifications.requestPermissions();
      if (status.display === 'granted') return 'granted';
    }
  } catch {
    // Continue to Web API
  }

  // 2. Web Notification API
  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (err) {
      console.error('Error requesting notification permission:', err);
      return 'denied';
    }
  }

  return 'unsupported';
}

// Check current permission state
export function getNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// Dispatch System Notification (Native Status Bar + Web)
export async function sendSystemNotification({ title, message, priority = 'normal', tag = 'announcement' }) {
  // 1. Audio chime & native haptic feedback
  playNotificationSound();
  triggerHaptic(priority === 'urgent' ? 'error' : 'success');

  const notificationTitle = priority === 'urgent'
    ? `🚨 URGENT: ${title}`
    : priority === 'important'
      ? `🔔 NOTICE: ${title}`
      : `📢 DIGISPIRE: ${title}`;

  // 2. Try Native Android Local Notification
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    if (LocalNotifications) {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display === 'granted') {
        await LocalNotifications.schedule({
          notifications: [
            {
              title: notificationTitle,
              body: message,
              id: Math.floor(Math.random() * 1000000),
              schedule: { at: new Date(Date.now() + 100) },
              sound: 'default',
              smallIcon: 'ic_launcher',
              iconColor: '#255A84',
              actionTypeId: '',
              extra: { url: '/student/dashboard', tag }
            }
          ]
        });
        return true;
      }
    }
  } catch {
    // Fall back to Web/PWA Notification
  }

  // 3. Web Notification API check
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  const options = {
    body: message,
    icon: '/logo.png',
    badge: '/logo.png',
    tag: tag,
    renotify: true,
    requireInteraction: priority === 'urgent',
    silent: false,
    data: {
      url: '/student/dashboard'
    }
  };

  // Try Service Worker registration for PWA system notification
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(notificationTitle, options);
        return true;
      }
    } catch (swErr) {
      console.warn('Service Worker notification fallback:', swErr);
    }
  }

  // Fallback to standard Desktop / Browser Notification constructor
  try {
    const notif = new Notification(notificationTitle, options);
    notif.onclick = function (event) {
      event.preventDefault();
      window.focus();
      window.location.href = '/student/dashboard';
    };
    return true;
  } catch (e) {
    console.error('Error creating Notification instance:', e);
    return false;
  }
}
