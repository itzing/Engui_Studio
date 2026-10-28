'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import MobileRouteEventBridge from './MobileRouteEventBridge';
import { installMobileKeyboardRecovery } from '@/lib/mobile/mobileKeyboardRecovery';
import { installMobileViewportDiagnostics } from '@/lib/mobile/mobileViewportDiagnostics';

export default function MobileAppProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const recovery = useRef<ReturnType<typeof installMobileKeyboardRecovery> | null>(null);

  useEffect(() => {
    document.body.classList.add('engui-mobile-shell');
    const controller = installMobileKeyboardRecovery();
    recovery.current = controller;
    const disposeDiagnostics = installMobileViewportDiagnostics();
    return () => {
      recovery.current = null;
      controller.dispose();
      disposeDiagnostics();
      document.body.classList.remove('engui-mobile-shell');
    };
  }, []);

  useEffect(() => {
    // Route changes can remove the focused editor without a focusout event.
    recovery.current?.schedule();
  }, [pathname]);

  return (
    <>
      <MobileRouteEventBridge />
      {children}
    </>
  );
}
