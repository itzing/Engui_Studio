'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import MobileRouteEventBridge from './MobileRouteEventBridge';
import { installMobileViewport } from '@/lib/mobile/mobileViewport';

export default function MobileAppProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // A route can remove the focused input without dispatching focusout.
  useEffect(() => installMobileViewport(), [pathname]);

  return (
    <>
      <MobileRouteEventBridge />
      {children}
    </>
  );
}
