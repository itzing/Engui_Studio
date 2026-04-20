'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getMobileTabForPathname } from './mobileNavigation';

const routeEvents: Record<string, string> = {
  mobileOpenCreateTab: '/m/create',
  mobileOpenPreviewTab: '/m/jobs',
  openPreviewInfo: '/m/jobs',
  mobileOpenJobsTab: '/m/jobs',
  mobileOpenGalleryTab: '/m/gallery',
};

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

    return () => {
      cleanups.forEach(cleanup => cleanup());
    };
  }, [router]);

  return null;
}
