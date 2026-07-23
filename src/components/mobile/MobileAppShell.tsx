'use client';

import type { ReactNode } from 'react';
import React from 'react';
import { RotateCcw } from 'lucide-react';
import MobileBottomNav from './MobileBottomNav';
import { useViewportFormFactor } from '@/hooks/mobile/useViewportFormFactor';

function MobileOrientationGate({ title }: { title: string }) {
  return (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-background p-6 text-foreground">
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted/40 text-foreground">
          <RotateCcw className="h-7 w-7" />
        </div>
        <div className="text-2xl font-semibold">{title}</div>
      </div>
    </div>
  );
}

export default function MobileAppShell({ children }: { children: ReactNode }) {
  const formFactor = useViewportFormFactor();

  if (formFactor === 'phone-landscape') {
    return <MobileOrientationGate title="Rotate your phone" />;
  }

  if (formFactor === 'tablet-portrait') {
    return <MobileOrientationGate title="Rotate to landscape" />;
  }

  const isTabletLandscape = formFactor === 'tablet-landscape';

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-background text-foreground" data-form-factor={formFactor}>
      <div className="min-h-0 flex-1 overflow-hidden pt-[env(safe-area-inset-top,0px)]">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          {children}
        </div>
      </div>
      {isTabletLandscape ? null : <MobileBottomNav />}
    </div>
  );
}
