'use client';

import { useEffect } from 'react';

const SW_VERSION = '2026-04-24-2';
const SW_RELOAD_KEY = `engui:pwa:reloaded:${SW_VERSION}`;

export function PWARegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    let didCancel = false;

    const handleControllerChange = () => {
      if (didCancel) return;
      if (window.sessionStorage.getItem(SW_RELOAD_KEY) === '1') return;
      window.sessionStorage.setItem(SW_RELOAD_KEY, '1');
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register(`/sw.js?v=${SW_VERSION}`, {
          scope: '/',
          updateViaCache: 'none',
        });
        await registration.update();
      } catch (error) {
        console.error('Failed to register service worker:', error);
      }
    };

    void register();

    return () => {
      didCancel = true;
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  return null;
}
