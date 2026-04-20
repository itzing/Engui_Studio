import type { ReactNode } from 'react';
import MobileAppProviders from '@/components/mobile/MobileAppProviders';

export default function MobileLayout({ children }: { children: ReactNode }) {
  return <MobileAppProviders>{children}</MobileAppProviders>;
}
