'use client';

import type { CreateMode } from '@/lib/createDrafts';

export const CREATE_MODE_EVENT = 'engui:create-mode-changed';

export function announceCreateModeChange(mode: CreateMode) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CREATE_MODE_EVENT, {
    detail: {
      mode,
      token: Date.now(),
    },
  }));
}
