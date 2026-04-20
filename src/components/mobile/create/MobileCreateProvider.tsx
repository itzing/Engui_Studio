'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useImageCreateState } from '@/hooks/create/useImageCreateState';

type MobileImageCreateState = ReturnType<typeof useImageCreateState>;

const MobileCreateContext = createContext<MobileImageCreateState | null>(null);

export default function MobileCreateProvider({ children }: { children: ReactNode }) {
  const state = useImageCreateState();
  return (
    <MobileCreateContext.Provider value={state}>
      {children}
    </MobileCreateContext.Provider>
  );
}

export function useMobileCreate() {
  const value = useContext(MobileCreateContext);
  if (!value) {
    throw new Error('useMobileCreate must be used inside MobileCreateProvider');
  }
  return value;
}
