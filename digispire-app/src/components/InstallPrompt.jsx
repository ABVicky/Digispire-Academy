import { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) return;

    // Check if user has already dismissed or installed
    const pwaStatus = localStorage.getItem('pwa-install-status');
    if (pwaStatus === 'dismissed' || pwaStatus === 'installed') return;

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);

    if (isIOSDevice) {
      // Show iOS instructions after 5 seconds
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      // Handle Android/Chrome beforeinstallprompt
      const handleBeforeInstallPrompt = (e) => {
        e.preventDefault();
        setDeferredPrompt(e);
        // Show prompt after 5 seconds
        setTimeout(() => {
          setShowPrompt(true);
        }, 5000);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      // For iOS, we just show the instructions. The user has to do it manually.
      // We'll mark it as dismissed so we don't annoy them again.
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
    <div className="fixed bottom-24 left-4 right-4 z-[100] animate-in slide-in-from-bottom-10 duration-500">
      <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 p-6 flex items-center gap-4 relative overflow-hidden">
        {/* Background Accent */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-12 -mt-12 opacity-50" />
        
        <div className="h-14 w-14 bg-white border border-slate-100 rounded-2xl flex items-center justify-center shadow-sm shrink-0 relative z-10">
          <img src="/logo.png" alt="App Icon" className="h-10 w-10 object-contain" />
        </div>

        <div className="flex-1 relative z-10">
          <h3 className="font-bold text-slate-800 text-sm">Install DIGISPIRE</h3>
          <p className="text-[10px] font-medium text-slate-500 leading-relaxed mt-0.5">
            {isIOS 
              ? 'Tap Share then "Add to Home Screen"' 
              : 'Add to your home screen for a better experience'}
          </p>
        </div>

        <div className="flex items-center gap-2 relative z-10">
          <button 
            onClick={handleInstall}
            className="bg-[#255A84] text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-md flex items-center gap-2"
          >
            {isIOS ? <Share size={14} /> : <Download size={14} />}
            {isIOS ? 'How?' : 'Install'}
          </button>
          <button 
            onClick={handleDismiss}
            className="p-2 text-slate-300 hover:text-slate-500 transition"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
