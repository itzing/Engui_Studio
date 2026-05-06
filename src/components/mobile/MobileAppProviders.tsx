'use client';

import { useEffect, type ReactNode } from 'react';
import { StudioProvider } from '@/lib/context/StudioContext';
import MobileRouteEventBridge from './MobileRouteEventBridge';

export default function MobileAppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.body.classList.add('engui-mobile-shell');
    return () => {
      document.body.classList.remove('engui-mobile-shell');
    };
  }, []);

  return (
    <StudioProvider>
      <MobileRouteEventBridge />
      {children}
    </StudioProvider>
  );
}
