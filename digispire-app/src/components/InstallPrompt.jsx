import { useState, useEffect } from 'react';
import { Download, X, Smartphone, Sparkles, Share2 } from 'lucide-react';

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already running in standalone PWA mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) return;

    // Check if dismissed recently (7 days memory)
    const dismissedAt = localStorage.getItem('ds_pwa_install_dismissed');
    if (dismissedAt) {
      const daysSince = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) return;
    }

    // Check if iOS Safari
    const ua = navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua) && !window.MSStream;
    const isSafari = /safari/.test(ua) && !/chrome|crios|fxios/.test(ua);

    if (isIos && isSafari) {
      setIsIOS(true);
      const timer = setTimeout(() => setShowPrompt(true), 5000);
      return () => clearTimeout(timer);
    }

    // Android / Chrome / Desktop PWA prompt
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowPrompt(true), 4000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem('ds_pwa_install_dismissed', Date.now().toString());
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-3 left-3 sm:left-auto sm:w-96 z-40 bg-[#1E293B] text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border border-slate-700/80 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-white p-1 shadow-sm flex items-center justify-center shrink-0 border border-white/20">
          <img src="/logo.png" alt="DIGISPIRE" className="h-full w-full object-contain" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <h4 className="font-bold text-xs tracking-tight text-white flex items-center gap-1.5">
              <span>Install DIGISPIRE App</span>
              <Sparkles size={12} className="text-amber-300" />
            </h4>
            <button
              onClick={handleDismiss}
              className="text-slate-400 hover:text-white p-1 rounded cursor-pointer transition"
              aria-label="Dismiss install prompt"
            >
              <X size={14} />
            </button>
          </div>

          <p className="text-[11px] text-slate-300 leading-snug mt-1">
            {isIOS ? (
              <span className="flex items-center gap-1">
                Tap <Share2 size={12} className="inline text-sky-300" /> then select <strong>Add to Home Screen</strong>.
              </span>
            ) : (
              'Install for 1-tap offline access, fast loading, and notifications.'
            )}
          </p>

          {!isIOS && deferredPrompt && (
            <div className="mt-2.5 flex items-center gap-2">
              <button
                onClick={handleInstall}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-extrabold rounded-lg text-[10px] uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Download size={12} />
                <span>Install Now</span>
              </button>
              <button
                onClick={handleDismiss}
                className="px-2 py-1 text-slate-300 hover:text-white text-[10px] font-semibold transition cursor-pointer"
              >
                Maybe Later
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
