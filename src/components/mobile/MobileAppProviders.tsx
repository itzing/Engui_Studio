'use client';

import { useEffect, type ReactNode } from 'react';
import MobileQueueNotifications from './MobileQueueNotifications';
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
    <MobileQueueNotifications>
      <MobileRouteEventBridge />
      {children}
    </MobileQueueNotifications>
  );
}
