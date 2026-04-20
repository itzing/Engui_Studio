import type { ReactNode } from 'react';
import MobileBottomNav from './MobileBottomNav';

export default function MobileAppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[100svh] max-h-[100svh] w-full flex-col overflow-hidden overscroll-none bg-background text-foreground">
      <div className="min-h-0 flex-1 overflow-hidden pt-[env(safe-area-inset-top,0px)]">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          {children}
        </div>
      </div>
      <MobileBottomNav />
    </div>
  );
}
