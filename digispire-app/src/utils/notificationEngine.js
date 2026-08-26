/**
 * DIGISPIRE System & Push Notification Engine
 * Handles Web Notifications API, Service Worker Push notifications,
 * audio chime synthesis, and haptic vibrations.
 */

// Web Audio API Synthesizer for smooth, crisp notification chime
export function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // First Tone (C5 - 523.25 Hz)
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

    // Second Higher Tone (G5 - 783.99 Hz)
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

// Request Browser & System Notification Permission
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return 'denied';
  }
}

// Check current permission state
export function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// Dispatch System Notification
export async function sendSystemNotification({ title, message, priority = 'normal', tag = 'announcement' }) {
  // 1. Play auditory chime and haptic pulse
  playNotificationSound();
  if (navigator.vibrate) {
    navigator.vibrate([150, 80, 150]);
  }

  // 2. Check Notification support & permission
  if (!('Notification' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  const notificationTitle = priority === 'urgent'
    ? `🚨 URGENT: ${title}`
    : priority === 'important'
      ? `🔔 NOTICE: ${title}`
      : `📢 DIGISPIRE: ${title}`;

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
      console.warn('Service Worker notification failed, falling back to Notification constructor:', swErr);
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
