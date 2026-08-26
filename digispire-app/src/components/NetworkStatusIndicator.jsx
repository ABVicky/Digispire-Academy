import { useState, useEffect } from 'react';
import { WifiOff, Wifi, CheckCircle2 } from 'lucide-react';

export default function NetworkStatusIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnectedToast, setShowReconnectedToast] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnectedToast(true);
      const timer = setTimeout(() => {
        setShowReconnectedToast(false);
      }, 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnectedToast(false);
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
      <div className="fixed top-0 left-0 right-0 z-50 bg-amber-600 text-white text-xs font-semibold py-1 px-4 flex items-center justify-center gap-2 shadow-md animate-in fade-in duration-200">
        <WifiOff size={14} className="animate-pulse" />
        <span>You are currently offline. Showing cached academic data.</span>
      </div>
    );
  }

  if (showReconnectedToast) {
    return (
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-emerald-700 text-white text-xs font-bold py-1.5 px-4 rounded-full flex items-center gap-2 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
        <CheckCircle2 size={14} />
        <span>Internet connection restored. Back online.</span>
      </div>
    );
  }

  return null;
}
