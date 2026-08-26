import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import app, { db } from '../firebase';
import { playNotificationSound } from './notificationEngine';

let messagingInstance = null;

// Initialize Firebase Cloud Messaging safely
export async function getFCMInstance() {
  const supported = await isSupported();
  if (!supported) {
    console.warn('Firebase Cloud Messaging is not supported in this browser environment.');
    return null;
  }
  if (!messagingInstance) {
    messagingInstance = getMessaging(app);
  }
  return messagingInstance;
}

// Register Background Service Worker and Obtain FCM Push Token
export async function registerPushNotificationToken(userProfile) {
  if (!userProfile?.uid || userProfile.role !== 'student') return null;

  try {
    const supported = await isSupported();
    if (!supported) return null;

    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      console.warn('Push notifications not supported on this platform.');
      return null;
    }

    // 1. Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission was not granted:', permission);
      return null;
    }

    // 2. Register FCM Service Worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/'
    });
    console.log('[FCM] Service Worker registered with scope:', registration.scope);

    const messaging = await getFCMInstance();
    if (!messaging) return null;

    // 3. Get FCM Device Token
    const currentToken = await getToken(messaging, {
      serviceWorkerRegistration: registration
    });

    if (currentToken) {
      console.log('[FCM] Device Push Token generated successfully');

      const studentBatchIds = [...(userProfile.batchIds || (userProfile.batchId ? [userProfile.batchId] : ['morning']))];
      if (userProfile.isIntern && !studentBatchIds.includes('internship')) {
        studentBatchIds.push('internship');
      }

      // 4. Save device push token to Firestore so backend/admin can target this device
      const tokenDocRef = doc(db, 'fcm_tokens', currentToken.slice(0, 60));
      await setDoc(tokenDocRef, {
        token: currentToken,
        uid: userProfile.uid,
        studentId: userProfile.studentId || '',
        name: userProfile.name || 'Student',
        batchIds: studentBatchIds,
        isIntern: !!userProfile.isIntern,
        userAgent: navigator.userAgent,
        platform: navigator.platform || 'web',
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Also update user document
      try {
        await updateDoc(doc(db, 'users', userProfile.uid), {
          fcmTokens: arrayUnion(currentToken),
          pushNotificationsEnabled: true,
          lastTokenUpdate: serverTimestamp()
        });
      } catch (userErr) {
        console.warn('Could not update user fcmTokens array:', userErr);
      }

      return currentToken;
    } else {
      console.warn('No registration token available. Request permission to generate one.');
      return null;
    }
  } catch (err) {
    console.error('An error occurred while retrieving FCM token:', err);
    return null;
  }
}

// Foreground Message Listener
export function setupForegroundPushListener(onMessageReceived) {
  getFCMInstance().then(messaging => {
    if (!messaging) return;

    onMessage(messaging, (payload) => {
      console.log('[FCM] Message received in foreground:', payload);
      playNotificationSound();
      if (onMessageReceived) {
        onMessageReceived(payload);
      }
    });
  });
}
