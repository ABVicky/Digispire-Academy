import { useRegisterSW } from 'virtual:pwa-register/react';
import { Sparkles, RefreshCw, X } from 'lucide-react';
import { triggerHaptic } from '../utils/haptic';

export default function PwaUpdateReload() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        // Check for updates periodically (every 1 hour)
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  const handleUpdate = () => {
    triggerHaptic('success');
    updateServiceWorker(true);
  };

  const handleDismiss = () => {
    triggerHaptic('light');
    setNeedRefresh(false);
  };

  if (!needRefresh) return null;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md animate-in fade-in slide-in-from-top-3 duration-300">
      <div className="bg-gradient-to-r from-[#0F172A] via-[#1E3A5F] to-[#255A84] text-white p-3 sm:p-3.5 rounded-2xl shadow-2xl border border-blue-400/30 backdrop-blur-xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-400/30">
            <Sparkles size={16} className="animate-spin-slow" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black text-white truncate flex items-center gap-1">
              <span>New Version Available</span>
            </p>
            <p className="text-[10px] text-blue-100 truncate">
              Update ready with performance improvements.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleUpdate}
            className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-[11px] uppercase tracking-wider transition flex items-center gap-1 shadow-md cursor-pointer active:scale-95"
          >
            <RefreshCw size={11} />
            <span>Update</span>
          </button>
          <button
            onClick={handleDismiss}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
            aria-label="Dismiss update notification"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
