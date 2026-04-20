'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

function isStandaloneMobilePwa() {
  if (typeof window === 'undefined') return false;

  const standaloneMatch = typeof window.matchMedia === 'function'
    ? window.matchMedia('(display-mode: standalone)').matches
    : false;
  const iosStandalone = typeof window.navigator !== 'undefined' && 'standalone' in window.navigator
    ? Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
    : false;
  const touchCapable = typeof window.navigator !== 'undefined'
    ? window.navigator.maxTouchPoints > 0 || /iPhone|iPad|iPod|Android/i.test(window.navigator.userAgent)
    : false;

  return touchCapable && (standaloneMatch || iosStandalone);
}

export default function MobilePwaRootRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== '/') return;
    if (!isStandaloneMobilePwa()) return;

    const query = typeof window !== 'undefined' ? window.location.search : '';
    router.replace(query ? `/m/create${query}` : '/m/create');
  }, [pathname, router]);

  return null;
}
