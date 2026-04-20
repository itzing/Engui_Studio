import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export default function MobileScreen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex h-full min-h-0 flex-col overflow-hidden bg-background', className)}>
      {children}
    </div>
  );
}
