import { useState, useEffect } from 'react';
import { Download, Smartphone, X, CheckCircle2, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [installedSuccessfully, setInstalledSuccessfully] = useState(false);

  useEffect(() => {
    // Check if app is already running in standalone PWA mode
    const isAppStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    setIsStandalone(isAppStandalone);

    // Detect iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for appinstalled
    const handleAppInstalled = () => {
      setInstalledSuccessfully(true);
      setDeferredPrompt(null);
      setTimeout(() => setShowBanner(false), 4000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show native prompt
    await deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;

    if (choiceResult.outcome === 'accepted') {
      console.log('User accepted the PWA install prompt');
      setInstalledSuccessfully(true);
      setTimeout(() => setShowBanner(false), 3000);
    }
    setDeferredPrompt(null);
  };

  // If already installed or banner dismissed, don't show
  if (isStandalone || !showBanner) return null;

  // Render for devices with install prompt available
  if (deferredPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 animate-bounceIn">
        <div className="bg-gradient-to-r from-[#1A032E] via-[#2A004A] to-[#0A0017] border-2 border-[#00D1FF] p-4 rounded-2xl shadow-[0_10px_35px_rgba(0,209,255,0.4)] flex items-center justify-between gap-3 text-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#00D1FF] to-purple-600 p-0.5 shrink-0 shadow-md">
              <img src="/pwa-192.png" alt="Fresherism App" className="w-full h-full rounded-[10px] object-cover" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wide text-white flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-[#00D1FF]" />
                Install Fresherism App
              </h4>
              <p className="text-[11px] text-zinc-300 font-medium">Fast, offline-ready mobile portal</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleInstallClick}
              className="px-3.5 py-1.5 bg-[#00D1FF] hover:bg-[#00b8e6] text-black font-black text-xs rounded-xl shadow-lg transition-all transform active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Install
            </button>
            <button
              onClick={() => setShowBanner(false)}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render iOS guide if user is on iOS Safari
  if (isIOS && !isStandalone) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50">
        <div className="bg-gradient-to-r from-[#1A032E] via-[#2A004A] to-[#0A0017] border-2 border-[#00D1FF] p-4 rounded-2xl shadow-2xl text-white space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#00D1FF]" />
              <h4 className="text-xs font-black uppercase tracking-wide text-white">Add Fresherism '26 to Home Screen</h4>
            </div>
            <button onClick={() => setShowBanner(false)} className="text-zinc-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-zinc-300 leading-relaxed">
            To install as an app on iOS: Tap <Share className="w-3.5 h-3.5 inline text-[#00D1FF]" /> <span className="text-[#00D1FF] font-bold">Share</span> and select <span className="text-[#00D1FF] font-bold">'Add to Home Screen'</span>.
          </p>
        </div>
      </div>
    );
  }

  if (installedSuccessfully) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <div className="bg-emerald-950 border-2 border-emerald-400 text-emerald-100 px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          Fresherism App installed successfully!
        </div>
      </div>
    );
  }

  return null;
}
