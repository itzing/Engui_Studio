'use client';

import type { CreateMode } from '@/lib/createDrafts';

export const CREATE_MODE_EVENT = 'engui:create-mode-changed';
export const CREATE_REUSE_DRAFT_EVENT = 'engui:create-reuse-draft';

export type CreateReuseDraftEventDetail = {
  workflow: CreateMode;
  modelId: string;
  token: number;
};

export function announceCreateModeChange(mode: CreateMode) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CREATE_MODE_EVENT, {
    detail: {
      mode,
      token: Date.now(),
    },
  }));
}

export function announceCreateReuseDraft(workflow: CreateMode, modelId: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<CreateReuseDraftEventDetail>(CREATE_REUSE_DRAFT_EVENT, {
    detail: {
      workflow,
      modelId,
      token: Date.now(),
    },
  }));
}
