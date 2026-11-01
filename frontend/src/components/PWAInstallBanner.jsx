import React, { useState, useEffect } from 'react';

/**
 * PWAInstallBanner:
 * Triggers and renders an interactive municipal PWA installation banner on mobile and desktop browsers.
 * - Captures the standard browser `beforeinstallprompt` event.
 * - Handles iOS Safari specific "Add to Home Screen" instructions.
 * - Automatically hides when the app is launched in standalone mode.
 * - Dismissable with temporary persistence in localStorage.
 */
const PWAInstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 1. Check if already installed & running in standalone mode
    const standaloneCheck =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    if (standaloneCheck) {
      setIsStandalone(true);
      return;
    }

    // 2. Check iOS platform
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);

    // 3. Check if user dismissed recently (dismissed for 24 hours)
    const lastDismissed = localStorage.getItem('janmitra_pwa_dismissed');
    if (lastDismissed && Date.now() - parseInt(lastDismissed, 10) < 24 * 60 * 60 * 1000) {
      return;
    }

    // 4. Capture beforeinstallprompt event for Android / Chrome / Edge
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // On iOS, if not standalone and not recently dismissed, show banner after a small delay
    if (isIOSDevice && !standaloneCheck) {
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (!deferredPrompt) {
      return;
    }

    // Show native browser install prompt
    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('[PWA] User accepted the JANMITRA installation prompt');
    } else {
      console.log('[PWA] User dismissed the JANMITRA installation prompt');
    }

    setDeferredPrompt(null);
    setShowBanner(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('janmitra_pwa_dismissed', Date.now().toString());
    setShowBanner(false);
    setShowIOSGuide(false);
  };

  if (isStandalone || !showBanner) {
    return null;
  }

  return (
    <div
      role="banner"
      aria-label="Install JANMITRA App"
      className="fixed bottom-20 md:bottom-6 left-4 right-4 max-w-lg mx-auto z-50 animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-xl shadow-slate-950/20 border border-slate-700/80 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 p-0.5 flex items-center justify-center shadow-md shrink-0">
              <span className="font-black text-white text-xl">🏛️</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-black text-sm tracking-tight text-white">
                  Install JANMITRA (जनमित्र)
                </h4>
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold">
                  Official PWA
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">
                Fast mobile access, live GPS mapping, and offline complaint tracking on your home screen.
              </p>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            aria-label="Dismiss install banner"
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            ✕
          </button>
        </div>

        {/* iOS Step-by-Step Guide Modal / Expandable */}
        {showIOSGuide && (
          <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 space-y-1.5 animate-in fade-in duration-200">
            <p className="font-bold text-amber-400 flex items-center gap-1.5">
              <span>📱</span> To install on iOS Safari:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-slate-300 pl-1">
              <li>Tap the <strong>Share</strong> button <span className="text-base">⎙</span> in Safari's toolbar.</li>
              <li>Scroll down and tap <strong>'Add to Home Screen'</strong> <span className="text-base">➕</span>.</li>
              <li>Tap <strong>Add</strong> in the top-right corner to launch JANMITRA as an app.</li>
            </ol>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 text-xs text-slate-300 hover:text-white font-medium rounded-lg transition"
          >
            Not Now
          </button>
          <button
            onClick={handleInstallClick}
            className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs rounded-xl shadow-sm transition active:scale-95 flex items-center gap-1.5"
          >
            <span>📥</span>
            <span>{isIOS ? 'Install Guide' : 'Install App'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallBanner;
