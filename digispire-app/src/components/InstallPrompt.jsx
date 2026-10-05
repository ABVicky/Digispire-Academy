import { useState, useEffect, useCallback } from 'react';
import { Download, X, Smartphone, Sparkles, Share2, PlusSquare, Check, ShieldCheck, Zap } from 'lucide-react';
import { triggerHaptic } from '../utils/haptic';

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  // Check standalone mode
  const checkStandalone = useCallback(() => {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://')
    );
  }, []);

  useEffect(() => {
    if (checkStandalone()) {
      setIsInstalled(true);
      return;
    }

    // Check if iOS Safari
    const ua = navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua) && !window.MSStream;
    const isSafariBrowser = /safari/.test(ua) && !/chrome|crios|fxios|opt|edg/.test(ua);

    if (isIosDevice) {
      setIsIOS(true);
    }

    // Check dismissal memory (5 days)
    const dismissedAt = localStorage.getItem('ds_pwa_install_dismissed');
    let shouldAutoShow = true;
    if (dismissedAt) {
      const daysSince = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
      if (daysSince < 5) shouldAutoShow = false;
    }

    // Capture Android / Chrome / Desktop beforeinstallprompt
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (shouldAutoShow) {
        const timer = setTimeout(() => setShowPrompt(true), 3500);
        return () => clearTimeout(timer);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // If iOS Safari and not dismissed, show after 5s
    if (isIosDevice && isSafariBrowser && shouldAutoShow) {
      const timer = setTimeout(() => setShowPrompt(true), 4500);
      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        clearTimeout(timer);
      };
    }

    // App installed event listener
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setInstalledSuccess(true);
      setTimeout(() => setInstalledSuccess(false), 4000);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    // Custom global event to trigger install prompt manually from anywhere (e.g. ProfilePage)
    const handleManualTrigger = () => {
      setShowPrompt(true);
    };
    window.addEventListener('ds:trigger-pwa-install', handleManualTrigger);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('ds:trigger-pwa-install', handleManualTrigger);
    };
  }, [checkStandalone]);

  const handleInstall = async () => {
    triggerHaptic('medium');
    if (!deferredPrompt) {
      // If triggered on a platform without native prompt capture, keep prompt open with guidance
      return;
    }
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.error('PWA install prompt error:', err);
    }
  };

  const handleDismiss = () => {
    triggerHaptic('light');
    localStorage.setItem('ds_pwa_install_dismissed', Date.now().toString());
    setShowPrompt(false);
  };

  if (isInstalled && !installedSuccess) return null;

  // Installed Toast
  if (installedSuccess) {
    return (
      <div className="fixed bottom-20 md:bottom-6 right-3 left-3 sm:left-auto sm:w-80 z-50 bg-emerald-950/95 text-white p-3.5 rounded-2xl shadow-2xl border border-emerald-500/40 backdrop-blur-md flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="h-8 w-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
          <Check size={18} strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-xs font-black text-white">DIGISPIRE Installed!</p>
          <p className="text-[10px] text-emerald-200">App is ready on your home screen.</p>
        </div>
      </div>
    );
  }

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-3 left-3 sm:left-auto sm:w-[380px] z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B132B] via-[#1C2541] to-[#1E3A5F] text-white p-4 sm:p-5 shadow-2xl border border-white/15 backdrop-blur-xl">
        {/* Ambient glow accent */}
        <div className="absolute -top-12 -right-12 w-28 h-28 bg-[#3A86C8]/25 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-3.5">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-white p-1.5 shadow-md shadow-black/30 flex items-center justify-center shrink-0 border border-white/20">
                <img src="/logo.png" alt="DIGISPIRE Logo" className="h-full w-full object-contain" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-[9px] font-extrabold text-blue-200 uppercase tracking-widest border border-white/10">
                  <Sparkles size={10} className="text-amber-400" />
                  <span>Official App</span>
                </div>
                <h4 className="font-black text-sm text-white tracking-tight leading-snug mt-0.5">
                  Install DIGISPIRE App
                </h4>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition cursor-pointer shrink-0"
              aria-label="Dismiss installation prompt"
            >
              <X size={15} />
            </button>
          </div>

          {/* Feature Highlight Pills */}
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="bg-white/5 border border-white/10 rounded-xl p-1.5">
              <Zap size={13} className="mx-auto text-amber-400 mb-0.5" />
              <p className="text-[9px] font-bold text-slate-200">Instant Load</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-1.5">
              <Smartphone size={13} className="mx-auto text-sky-400 mb-0.5" />
              <p className="text-[9px] font-bold text-slate-200">1-Tap Access</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-1.5">
              <ShieldCheck size={13} className="mx-auto text-emerald-400 mb-0.5" />
              <p className="text-[9px] font-bold text-slate-200">Offline Notes</p>
            </div>
          </div>

          {/* iOS Safari Specific Step-by-Step Instructions */}
          {isIOS ? (
            <div className="bg-black/30 rounded-2xl p-3 border border-white/10 space-y-2 text-xs">
              <p className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                <span>How to install on iPhone / iPad:</span>
              </p>
              <ol className="space-y-1.5 text-[10.5px] text-slate-300 pl-1 font-medium leading-relaxed">
                <li className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-white/15 text-white flex items-center justify-center font-bold text-[10px] shrink-0">1</span>
                  <span>Tap the <Share2 size={13} className="inline text-sky-300 mx-0.5" /> <strong>Share</strong> button in Safari</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-white/15 text-white flex items-center justify-center font-bold text-[10px] shrink-0">2</span>
                  <span>Select <PlusSquare size={13} className="inline text-emerald-300 mx-0.5" /> <strong>Add to Home Screen</strong></span>
                </li>
              </ol>
            </div>
          ) : (
            /* Android / Desktop / Chrome Action Buttons */
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleInstall}
                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer"
              >
                <Download size={14} strokeWidth={2.5} />
                <span>Install Now</span>
              </button>

              <button
                onClick={handleDismiss}
                className="py-2.5 px-3 bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Later
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
