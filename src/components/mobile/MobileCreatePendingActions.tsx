'use client';

import { useEffect } from 'react';
import { PENDING_REUSE_KEY } from './MobileRouteEventBridge';

export default function MobileCreatePendingActions() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timeoutId: number | null = null;

    try {
      const rawValue = window.localStorage.getItem(PENDING_REUSE_KEY);
      if (!rawValue) return;

      const detail = JSON.parse(rawValue);
      window.localStorage.removeItem(PENDING_REUSE_KEY);

      timeoutId = window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('reuseJobInput', { detail }));
      }, 0);
    } catch {
      window.localStorage.removeItem(PENDING_REUSE_KEY);
    }

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  return null;
}
