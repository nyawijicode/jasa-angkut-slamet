import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);

  useEffect(() => {
    // 1. Check if already running in standalone mode (already installed and opened as app)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
      return isStandaloneMode;
    };

    if (checkStandalone()) {
      return;
    }

    // 2. Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as unknown as { MSStream?: boolean }).MSStream;
    const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios/.test(userAgent);
    setIsIOS(isIosDevice && isSafari);

    // 3. Listen to display-mode change (e.g. if installed mid-session)
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsStandalone(true);
        setShowPrompt(false);
      }
    };
    mediaQuery.addEventListener('change', handleDisplayModeChange);

    // 4. Check getInstalledRelatedApps if supported
    if ('getInstalledRelatedApps' in navigator) {
      (navigator as unknown as { getInstalledRelatedApps: () => Promise<unknown[]> })
        .getInstalledRelatedApps()
        .then((apps) => {
          if (apps && apps.length > 0) {
            // App is installed on this device
            setIsStandalone(true);
            setShowPrompt(false);
          }
        })
        .catch(() => {
          // Ignore error, fallback to beforeinstallprompt
        });
    }

    // 5. Check if user dismissed it in this current browsing session
    const sessionDismissed = sessionStorage.getItem('pwa_prompt_dismissed');

    // 6. Listen for the native beforeinstallprompt event (Android / Chromium)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);

      // App is not installed (or was uninstalled). If not dismissed in this session, show prompt
      if (!sessionDismissed) {
        // Small delay so it smoothly slides in without blocking initial page paint
        const timer = setTimeout(() => {
          setShowPrompt(true);
        }, 1800);
        return () => clearTimeout(timer);
      }
    };

    // 7. Listen for appinstalled event (fired immediately when user finishes install)
    const handleAppInstalled = () => {
      setShowPrompt(false);
      setDeferredPrompt(null);
      setIsStandalone(true);
      sessionStorage.removeItem('pwa_prompt_dismissed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // If iOS Safari and not standalone and not dismissed this session, show iOS install guide
    if (isIosDevice && isSafari && !sessionDismissed) {
      const iosTimer = setTimeout(() => {
        setShowPrompt(true);
      }, 2500);
      return () => clearTimeout(iosTimer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery.removeEventListener('change', handleDisplayModeChange);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    // Trigger the native browser install dialog
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowPrompt(false);
      setDeferredPrompt(null);
      setIsStandalone(true);
    } else {
      // User dismissed native prompt, remember for this session
      setShowPrompt(false);
      sessionStorage.setItem('pwa_prompt_dismissed', '1');
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Only dismiss for the current session, so if reopened or uninstalled it will reappear
    sessionStorage.setItem('pwa_prompt_dismissed', '1');
  };

  // If already installed or currently running as standalone app, do not show
  if (isStandalone || !showPrompt) {
    return null;
  }

  return (
    <aside
      className="pwa-toast-banner"
      role="dialog"
      aria-labelledby="pwa-toast-title"
      aria-describedby="pwa-toast-desc"
    >
      <div className="pwa-toast-card">
        <div className="pwa-toast-content">
          <div className="pwa-toast-icon-wrap" aria-hidden="true">
            <img
              src="/icon-192.png"
              alt="Jasa Angkut Slamet"
              width="44"
              height="44"
              className="pwa-toast-app-icon"
            />
          </div>

          <div className="pwa-toast-text">
            <div className="pwa-toast-header">
              <strong id="pwa-toast-title" className="pwa-toast-title">
                Pasang Aplikasi Jasa Angkut
              </strong>
              <span className="pwa-toast-badge">PWA Resmi</span>
            </div>
            <p id="pwa-toast-desc" className="pwa-toast-desc">
              {isIOS
                ? 'Akses cepat dari layar utama: Tekan tombol Bagikan (Share) lalu pilih "Tambah ke Layar Utama".'
                : 'Pesan armada & cek tarif lebih cepat langsung dari layar utama tanpa buka browser.'}
            </p>
          </div>

          <button
            type="button"
            className="pwa-toast-close"
            onClick={handleDismiss}
            aria-label="Tutup notifikasi install"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="pwa-toast-actions">
          {!isIOS && deferredPrompt && (
            <button
              type="button"
              className="btn btn-primary pwa-btn-install"
              onClick={handleInstallClick}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Install Aplikasi</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-outline pwa-btn-dismiss"
            onClick={handleDismiss}
          >
            {isIOS ? 'Mengerti' : 'Nanti Saja'}
          </button>
        </div>
      </div>
    </aside>
  );
}
