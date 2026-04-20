'use client';

import type { ReactNode } from 'react';
import { StudioProvider } from '@/lib/context/StudioContext';
import MobileRouteEventBridge from './MobileRouteEventBridge';

export default function MobileAppProviders({ children }: { children: ReactNode }) {
  return (
    <StudioProvider>
      <MobileRouteEventBridge />
      {children}
    </StudioProvider>
  );
}
