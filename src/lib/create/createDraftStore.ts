'use client';
import { currentBrowserWorkspaceId, workspaceStorage } from '@/lib/workspaces/client';

import {
  CREATE_DRAFT_STATE_STORAGE_KEY,
  LEGACY_CREATE_DRAFT_STATE_STORAGE_KEY,
  createDefaultUnifiedCreateDraftState,
  type CreateWorkflow,
  type DraftEnvelope,
  type UnifiedCreateDraftState,
} from '@/lib/create/createDraftSchema';
import { normalizeCreateDraftState } from '@/lib/create/createDraftMigrations';

export function loadUnifiedCreateDraftState(workspaceId = currentBrowserWorkspaceId()): UnifiedCreateDraftState {
  const storage = workspaceStorage(workspaceId);
  const empty = { ...createDefaultUnifiedCreateDraftState(), ...(workspaceId ? { workspaceId } : {}) };
  if (!storage) return empty;
  const raw = storage.getItem(CREATE_DRAFT_STATE_STORAGE_KEY) || storage.getItem(LEGACY_CREATE_DRAFT_STATE_STORAGE_KEY);
  if (!raw) return empty;
  try { return { ...normalizeCreateDraftState(JSON.parse(raw)), workspaceId: workspaceId! }; }
  catch {
    storage.setItem(CREATE_DRAFT_STATE_STORAGE_KEY + '.recovery.' + Date.now(), raw);
    return empty;
  }
}

export function saveUnifiedCreateDraftState(state: UnifiedCreateDraftState) {
  const owner = state.workspaceId || currentBrowserWorkspaceId();
  const storage = workspaceStorage(owner);
  if (!storage) throw new Error('Cannot save a draft without a workspace.');
  storage.setItem(CREATE_DRAFT_STATE_STORAGE_KEY, JSON.stringify({ ...state, workspaceId: owner }));
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
