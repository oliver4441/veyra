'use client';

import { useEffect, useState, useCallback } from 'react';
import { Download, RefreshCw, WifiOff, X } from 'lucide-react';
import { api } from '@/lib/api';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [updateReady, setUpdateReady] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      window.setTimeout(() => setShowInstallBanner(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    setIsInstalled(window.matchMedia('(display-mode: standalone)').matches);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void api.flushOfflineQueue();
    };
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.onLine) void api.flushOfflineQueue();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((registration) => {
      const checkForUpdate = () => void registration.update();
      const timer = window.setInterval(checkForUpdate, 60 * 60 * 1000);

      if (registration.waiting) setUpdateReady(registration);

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateReady(registration);
          }
        });
      });

      return () => window.clearInterval(timer);
    }).catch((error) => {
      console.error('Veyra service worker registration failed:', error);
    });
  }, []);

  const applyUpdate = useCallback(() => {
    if (!updateReady?.waiting) return;
    updateReady.waiting.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  }, [updateReady]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallBanner(false);
      setIsInstalled(true);
    }
  }, [deferredPrompt]);

  const dismissInstallBanner = useCallback(() => {
    setShowInstallBanner(false);
    sessionStorage.setItem('veyra-install-dismissed', 'true');
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem('veyra-install-dismissed') === 'true') setShowInstallBanner(false);
  }, []);

  return (
    <>
      {children}

      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 bg-surface-container-high border-b border-white/10 px-4 py-2 text-center">
          <WifiOff size={14} className="text-on-surface-variant" />
          <span className="text-sm text-on-surface-variant">Offline mode — cached content is available.</span>
        </div>
      )}

      {updateReady && isOnline && (
        <div className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[110] glass-panel rounded-xl p-4 shadow-2xl border border-white/10">
          <div className="flex items-center gap-3">
            <RefreshCw size={18} className="text-primary" />
            <div className="flex-1">
              <h3 className="font-semibold text-white text-sm">Veyra has been updated</h3>
              <p className="text-xs text-on-surface-variant mt-1">Reload to use the latest version.</p>
            </div>
            <button onClick={applyUpdate} className="px-3 py-1.5 bg-primary text-on-primary text-xs font-semibold rounded-lg">Reload</button>
          </div>
        </div>
      )}

      {showInstallBanner && !isInstalled && deferredPrompt && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-[90] animate-slide-up">
          <div className="glass-panel rounded-xl p-4 shadow-2xl border border-white/10">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Download size={20} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white text-sm mb-1">Install Veyra</h3>
                <p className="text-xs text-on-surface-variant mb-3">Install the app for a faster, offline-capable experience.</p>
                <div className="flex gap-2">
                  <button onClick={handleInstall} className="px-3 py-1.5 bg-primary text-on-primary text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity">Install</button>
                  <button onClick={dismissInstallBanner} className="px-3 py-1.5 text-on-surface-variant text-xs hover:text-white transition-colors">Not now</button>
                </div>
              </div>
              <button onClick={dismissInstallBanner} className="text-on-surface-variant hover:text-white transition-colors flex-shrink-0"><X size={16} /></button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
