import { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS] = useState(() => typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream);

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) return;

    // Check if user has already dismissed or installed
    const pwaStatus = localStorage.getItem('pwa-install-status');
    if (pwaStatus === 'dismissed' || pwaStatus === 'installed') return;

    if (isIOS) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      const handleBeforeInstallPrompt = (e) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setTimeout(() => {
          setShowPrompt(true);
        }, 5000);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }
  }, [isIOS]);

  const handleInstall = async () => {
    if (isIOS) {
      handleDismiss();
    } else if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        localStorage.setItem('pwa-install-status', 'installed');
      }
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-install-status', 'dismissed');
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-24 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-4 flex items-center gap-3.5 relative overflow-hidden">
        <div className="h-10 w-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center p-1 shadow-2xs shrink-0">
          <img src="/logo.png" alt="DIGISPIRE" className="h-full w-full object-contain" />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-slate-800 text-xs tracking-tight leading-tight">Install Academic Portal</h4>
          <p className="text-[10px] text-slate-500 leading-tight mt-0.5 truncate">
            {isIOS 
              ? 'Tap Share → "Add to Home Screen"' 
              : 'Add to desktop/home screen for quick access'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button 
            onClick={handleInstall}
            className="bg-[#1E3A5F] hover:bg-[#12243A] text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
          >
            {isIOS ? <Share size={12} /> : <Download size={12} />}
            <span>{isIOS ? 'Instructions' : 'Install App'}</span>
          </button>
          <button 
            onClick={handleDismiss}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition cursor-pointer"
            aria-label="Dismiss banner"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
