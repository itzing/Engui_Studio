'use client';

import { useEffect, type ReactNode } from 'react';
import MobileRouteEventBridge from './MobileRouteEventBridge';

export default function MobileAppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.body.classList.add('engui-mobile-shell');
    return () => {
      document.body.classList.remove('engui-mobile-shell');
    };
  }, []);

  return (
    <>
      <MobileRouteEventBridge />
      {children}
    </>
  );
}
