import type { ReactNode } from 'react';
import MobileCreateProvider from '@/components/mobile/create/MobileCreateProvider';

export default function MobileCreateLayout({ children }: { children: ReactNode }) {
  return <MobileCreateProvider>{children}</MobileCreateProvider>;
}
