import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import {
  sendSystemNotification,
  requestNotificationPermission,
  getNotificationPermission
} from '../utils/notificationEngine';
import {
  registerPushNotificationToken,
  setupForegroundPushListener
} from '../utils/fcmMessaging';
import {
  Bell, AlertTriangle, Megaphone, X, ExternalLink, ShieldCheck, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AnnouncementNotificationWatcher() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [toastNotif, setToastNotif] = useState(null);
  const [permissionState, setPermissionState] = useState('default');
  const [showPermissionBanner, setShowPermissionBanner] = useState(false);
  const knownAnnouncementsRef = useRef(new Set());
  const isInitialLoadRef = useRef(true);

  // Check notification permission and auto-register FCM token if granted
  useEffect(() => {
    const current = getNotificationPermission();
    setPermissionState(current);

    if (current === 'granted' && userProfile?.role === 'student') {
      registerPushNotificationToken(userProfile).catch(console.warn);
    } else if (current === 'default') {
      const dismissedPrompt = sessionStorage.getItem('ds_notification_prompt_dismissed');
      if (!dismissedPrompt) {
        setShowPermissionBanner(true);
      }
    }
  }, [userProfile]);

  // Foreground FCM listener
  useEffect(() => {
    setupForegroundPushListener((payload) => {
      const title = payload.notification?.title || payload.data?.title || 'Academic Notice';
      const message = payload.notification?.body || payload.data?.message || '';
      const priority = payload.data?.priority || 'normal';

      setToastNotif({
        id: Date.now().toString(),
        title,
        message,
        priority,
        authorName: payload.data?.authorName || 'Faculty'
      });
    });
  }, []);

  const handleRequestPermission = async () => {
    const result = await requestNotificationPermission();
    setPermissionState(result);
    setShowPermissionBanner(false);

    if (result === 'granted') {
      await registerPushNotificationToken(userProfile);
      sendSystemNotification({
        title: 'Background Push Notifications Active',
        message: 'You will now receive system notifications even when the website is closed.',
        priority: 'normal',
        tag: 'welcome'
      });
    }
  };

  const dismissPermissionPrompt = () => {
    setShowPermissionBanner(false);
    sessionStorage.setItem('ds_notification_prompt_dismissed', 'true');
  };

  // Real-Time Announcement Snapshot Listener
  useEffect(() => {
    if (!userProfile || userProfile.role !== 'student') return;

    const studentBatchIds = [...(userProfile.batchIds || (userProfile.batchId ? [userProfile.batchId] : ['morning']))];
    if (userProfile.isIntern && !studentBatchIds.includes('internship')) {
      studentBatchIds.push('internship');
    }

    const unsubscribe = onSnapshot(collection(db, 'announcements'), (snapshot) => {
      // First snapshot load
      if (isInitialLoadRef.current) {
        snapshot.docs.forEach((docSnap) => {
          knownAnnouncementsRef.current.add(docSnap.id);
        });
        isInitialLoadRef.current = false;
        return;
      }

      // Check for newly added doc changes
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const docId = change.doc.id;
          const data = change.doc.data();

          if (!knownAnnouncementsRef.current.has(docId)) {
            knownAnnouncementsRef.current.add(docId);

            // Check if matches student's enrolled batches
            const targetList = Array.isArray(data.targetBatchIds)
              ? data.targetBatchIds
              : (data.targetBatchId ? [data.targetBatchId] : ['all']);

            const isMatchingStudent = targetList.includes('all') || studentBatchIds.some(bId => targetList.includes(bId));

            if (isMatchingStudent) {
              // 1. Trigger OS System Notification (works via Service Worker in background)
              sendSystemNotification({
                title: data.title || 'New Academic Announcement',
                message: data.message || 'Check your student dashboard for details.',
                priority: data.priority || 'normal',
                tag: docId
              });

              // 2. Trigger In-App Floating Toast Notification
              setToastNotif({
                id: docId,
                title: data.title || 'New Announcement',
                message: data.message || '',
                priority: data.priority || 'normal',
                authorName: data.authorName || 'Faculty'
              });

              // Auto dismiss toast after 8 seconds
              setTimeout(() => {
                setToastNotif((curr) => (curr?.id === docId ? null : curr));
              }, 8000);
            }
          }
        }
      });
    }, (error) => {
      console.error('Error in announcement snapshot listener:', error);
    });

    return () => unsubscribe();
  }, [userProfile]);

  return (
    <>
      {/* ── 1. One-Click Permission Request Banner (if default) ── */}
      {showPermissionBanner && permissionState === 'default' && (
        <div className="fixed top-3 right-3 left-3 sm:left-auto sm:w-96 z-50 bg-[#1E3A5F] text-white p-3.5 rounded-xl shadow-xl border border-slate-700 flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
            <Bell size={16} className="text-amber-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold tracking-tight">Enable Push Notifications</h4>
            <p className="text-[11px] text-slate-300 leading-snug mt-0.5">
              Receive instant alerts on your phone or desktop even when the browser or tab is closed.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleRequestPermission}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold rounded text-[10px] uppercase tracking-wider transition cursor-pointer"
              >
                Enable System Push
              </button>
              <button
                onClick={dismissPermissionPrompt}
                className="px-2 py-1 text-slate-300 hover:text-white text-[10px] font-semibold transition cursor-pointer"
              >
                Later
              </button>
            </div>
          </div>
          <button onClick={dismissPermissionPrompt} className="text-slate-400 hover:text-white p-1">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── 2. Real-Time In-App Floating Announcement Toast ── */}
      {toastNotif && (
        <div
          onClick={() => {
            navigate('/student/dashboard');
            setToastNotif(null);
          }}
          className={`fixed top-4 right-4 left-4 sm:left-auto sm:w-[420px] z-50 rounded-2xl p-4 shadow-2xl border cursor-pointer animate-in fade-in slide-in-from-top-6 duration-300 ${
            toastNotif.priority === 'urgent'
              ? 'bg-rose-950/95 text-white border-rose-600 ring-2 ring-rose-500/30'
              : toastNotif.priority === 'important'
                ? 'bg-amber-950/95 text-white border-amber-600 ring-2 ring-amber-500/30'
                : 'bg-[#1E293B]/95 text-white border-slate-700 ring-2 ring-sky-500/20'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
              toastNotif.priority === 'urgent'
                ? 'bg-rose-600 text-white'
                : toastNotif.priority === 'important'
                  ? 'bg-amber-600 text-white'
                  : 'bg-[#1E3A5F] text-white'
            }`}>
              {toastNotif.priority === 'urgent' ? (
                <AlertTriangle size={18} />
              ) : toastNotif.priority === 'important' ? (
                <Bell size={18} />
              ) : (
                <Megaphone size={18} />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className={`text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                  toastNotif.priority === 'urgent'
                    ? 'bg-rose-500/30 text-rose-300'
                    : toastNotif.priority === 'important'
                      ? 'bg-amber-500/30 text-amber-300'
                      : 'bg-sky-500/30 text-sky-300'
                }`}>
                  {toastNotif.priority === 'urgent' ? 'Urgent Alert' : toastNotif.priority === 'important' ? 'Important Notice' : 'Campus Broadcast'}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setToastNotif(null);
                  }}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X size={14} />
                </button>
              </div>

              <h4 className="font-bold text-xs sm:text-sm text-white tracking-tight mt-1.5 leading-snug">
                {toastNotif.title}
              </h4>
              <p className="text-[11px] text-slate-300 leading-relaxed mt-1 line-clamp-2">
                {toastNotif.message}
              </p>

              <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400">
                <span>By: {toastNotif.authorName}</span>
                <span className="text-sky-300 font-bold flex items-center gap-0.5">
                  View on Dashboard <ChevronRight size={12} />
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
