'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getMobileTabForPathname } from './mobileNavigation';

const routeEvents: Record<string, string> = {
  mobileOpenCreateTab: '/m/create',
  mobileOpenPreviewTab: '/m/preview',
  openPreviewInfo: '/m/preview',
  mobileOpenJobsTab: '/m/jobs',
  mobileOpenGalleryTab: '/m/gallery',
};

const PENDING_REUSE_KEY = 'engui.mobile.pending-reuse-input';

export default function MobileRouteEventBridge() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem('engui.mobile.active-tab', getMobileTabForPathname(pathname));
    } catch {
      // ignore storage errors
    }
  }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const navigate = (href: string) => {
      if (window.location.pathname !== href) {
        router.push(href);
      }
    };

    const cleanups = Object.entries(routeEvents).map(([eventName, href]) => {
      const handler = () => navigate(href);
      window.addEventListener(eventName, handler as EventListener);
      return () => window.removeEventListener(eventName, handler as EventListener);
    });

    const reuseHandler = (event: Event) => {
      if (pathname !== '/m/create') {
        const customEvent = event as CustomEvent;
        try {
          window.localStorage.setItem(PENDING_REUSE_KEY, JSON.stringify(customEvent.detail ?? null));
        } catch {
          // ignore storage errors
        }
      }

      navigate('/m/create');
    };

    window.addEventListener('reuseJobInput', reuseHandler as EventListener);

    return () => {
      cleanups.forEach(cleanup => cleanup());
      window.removeEventListener('reuseJobInput', reuseHandler as EventListener);
    };
  }, [pathname, router]);

  return null;
}

export { PENDING_REUSE_KEY };
