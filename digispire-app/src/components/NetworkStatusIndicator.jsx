import { useState, useEffect } from 'react';
import { WifiOff, CheckCircle2, CloudOff, RefreshCw } from 'lucide-react';
import { triggerHaptic } from '../utils/haptic';

export default function NetworkStatusIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnectedToast, setShowReconnectedToast] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnectedToast(true);
      triggerHaptic('success');
      const timer = setTimeout(() => {
        setShowReconnectedToast(false);
      }, 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnectedToast(false);
      triggerHaptic('heavy');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md animate-in fade-in slide-in-from-top-3 duration-300">
        <div className="bg-[#0F172A]/95 text-white p-2.5 sm:px-4 rounded-2xl shadow-xl border border-amber-500/40 backdrop-blur-md flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-7 w-7 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
              <CloudOff size={15} className="animate-pulse" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-amber-300 truncate">Offline Mode Active</p>
              <p className="text-[10px] text-slate-300 truncate">Cached course notes & materials are accessible.</p>
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="p-1.5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition shrink-0 cursor-pointer"
            title="Try reconnecting"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>
    );
  }

  if (showReconnectedToast) {
    return (
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md animate-in fade-in slide-in-from-top-3 duration-300">
        <div className="bg-[#0F172A]/95 text-white p-2.5 sm:px-4 rounded-2xl shadow-xl border border-emerald-500/40 backdrop-blur-md flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
            <CheckCircle2 size={15} />
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-300">Connection Restored</p>
            <p className="text-[10px] text-slate-300">Cloud synchronization resumed.</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
