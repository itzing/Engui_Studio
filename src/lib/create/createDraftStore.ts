'use client';

import {
  CREATE_DRAFT_STATE_STORAGE_KEY,
  LEGACY_CREATE_DRAFT_STATE_STORAGE_KEY,
  createDefaultUnifiedCreateDraftState,
  type CreateWorkflow,
  type DraftEnvelope,
  type UnifiedCreateDraftState,
} from '@/lib/create/createDraftSchema';
import { normalizeCreateDraftState } from '@/lib/create/createDraftMigrations';

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export function loadUnifiedCreateDraftState(): UnifiedCreateDraftState {
  const storage = getStorage();
  if (!storage) return createDefaultUnifiedCreateDraftState();

  try {
    const raw = storage.getItem(CREATE_DRAFT_STATE_STORAGE_KEY);
    if (raw) {
      return normalizeCreateDraftState(JSON.parse(raw));
    }

    const legacyRaw = storage.getItem(LEGACY_CREATE_DRAFT_STATE_STORAGE_KEY);
    if (legacyRaw) {
      return normalizeCreateDraftState(JSON.parse(legacyRaw));
    }
  } catch {
    return createDefaultUnifiedCreateDraftState();
  }

  return createDefaultUnifiedCreateDraftState();
}

export function saveUnifiedCreateDraftState(state: UnifiedCreateDraftState) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(CREATE_DRAFT_STATE_STORAGE_KEY, JSON.stringify(state));
}

export function getWorkflowBucket<TDraft = unknown>(state: UnifiedCreateDraftState, workflow: CreateWorkflow) {
  return state.workflows[workflow] as { activeModel?: string; drafts: Record<string, DraftEnvelope<TDraft>> };
}

export function getDraft<TDraft = unknown>(state: UnifiedCreateDraftState, workflow: CreateWorkflow, modelId: string): DraftEnvelope<TDraft> | null {
  return getWorkflowBucket<TDraft>(state, workflow).drafts[modelId] || null;
}

export function getActiveDraft<TDraft = unknown>(state: UnifiedCreateDraftState, workflow: CreateWorkflow): DraftEnvelope<TDraft> | null {
  const activeModel = getWorkflowBucket<TDraft>(state, workflow).activeModel;
  return activeModel ? getDraft<TDraft>(state, workflow, activeModel) : null;
}

export function setActiveModeInState(state: UnifiedCreateDraftState, workflow: CreateWorkflow): UnifiedCreateDraftState {
  return {
    ...state,
    activeMode: workflow,
  };
}

export function setWorkflowActiveModelInState(state: UnifiedCreateDraftState, workflow: CreateWorkflow, modelId: string): UnifiedCreateDraftState {
  return {
    ...state,
    workflows: {
      ...state.workflows,
      [workflow]: {
        ...state.workflows[workflow],
        activeModel: modelId,
      },
    },
  };
}

export function saveWorkflowDraftInState<TDraft = unknown>(state: UnifiedCreateDraftState, workflow: CreateWorkflow, modelId: string, draft: TDraft): UnifiedCreateDraftState {
  const bucket = getWorkflowBucket<TDraft>(state, workflow);
  return {
    ...state,
    workflows: {
      ...state.workflows,
      [workflow]: {
        ...bucket,
        activeModel: modelId,
        drafts: {
          ...bucket.drafts,
          [modelId]: {
            modelId,
            updatedAt: Date.now(),
            draft,
          },
        },
      },
    },
  };
}
