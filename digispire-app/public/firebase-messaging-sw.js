// Firebase Cloud Messaging Background Service Worker
// Enables receiving Web Push Notifications when the browser / website is in background or closed.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAcgI3Rg-W5hjccfR76HbwgJ-0GhHeX0ws",
  authDomain: "digispire-academy.firebaseapp.com",
  projectId: "digispire-academy",
  storageBucket: "digispire-academy.firebasestorage.app",
  messagingSenderId: "143103427249",
  appId: "1:143103427249:web:8a47bc78138deda87c1890"
});

const messaging = firebase.messaging();

// Handle Background Push Messages from Firebase Cloud Messaging
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background push message:', payload);
  
  const title = payload.notification?.title || payload.data?.title || '🚨 DIGISPIRE Academic Notice';
  const body = payload.notification?.body || payload.data?.message || payload.data?.body || 'New announcement published for your batch.';
  const priority = payload.data?.priority || 'normal';

  const notificationOptions = {
    body: body,
    icon: '/logo.png',
    badge: '/logo.png',
    tag: payload.data?.tag || 'announcement',
    vibrate: [200, 100, 200],
    requireInteraction: priority === 'urgent',
    renotify: true,
    data: {
      url: payload.data?.url || '/student/dashboard'
    }
  };

  return self.registration.showNotification(title, notificationOptions);
});

// Handle Notification Click (Focus or Open App Window)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/student/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If student already has the tab open, focus it
      for (let client of windowClients) {
        if (client.url.includes('/student') && 'focus' in client) {
          return client.focus();
        }
      }
      // If not open, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
