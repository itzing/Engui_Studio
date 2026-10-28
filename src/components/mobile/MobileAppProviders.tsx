'use client';

import { useEffect, type ReactNode } from 'react';
import MobileRouteEventBridge from './MobileRouteEventBridge';
import { installStandalonePhoneHeight } from '@/lib/mobile/standalonePhoneHeight';

export default function MobileAppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.body.classList.add('engui-mobile-shell');
    const disposeHeight = installStandalonePhoneHeight();
    return () => {
      disposeHeight();
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
