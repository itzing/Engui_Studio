'use client';

import {
  createDefaultUnifiedCreateDraftState,
  type CreateMediaRef,
  type CreateWorkflow,
  type DraftEnvelope,
  type UnifiedCreateDraftState,
} from '@/lib/create/createDraftSchema';

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function isRemoteUrl(value: unknown) {
  return typeof value === 'string' && value.trim() !== '' && !value.startsWith('data:');
}

function toMediaRef(url: unknown, fallbackSource: CreateMediaRef['source'] = 'external'): CreateMediaRef | null {
  if (typeof url !== 'string' || url.trim() === '') return null;
  return {
    kind: 'remote-url',
    url,
    source: fallbackSource,
  };
}

function migrateDraft(workflow: CreateWorkflow, modelId: string, draft: any): DraftEnvelope<any> {
  const nextDraft = cloneState(draft || {});

  if (workflow === 'image') {
    const primary = toMediaRef(nextDraft.previewUrl, nextDraft.selectedSceneId ? 'scene' : 'external');
    const secondary = toMediaRef(nextDraft.previewUrl2, 'external');
    nextDraft.inputs = {
      primary,
      secondary,
    };
  }

  return {
    modelId,
    updatedAt: Date.now(),
    draft: nextDraft,
  };
}

export function migrateLegacyCreateDraftState(raw: unknown): UnifiedCreateDraftState {
  const defaultState = createDefaultUnifiedCreateDraftState();
  if (!raw || typeof raw !== 'object') return defaultState;

  const parsed = raw as any;
  const next = createDefaultUnifiedCreateDraftState();
  next.activeMode = parsed.activeMode || defaultState.activeMode;

  for (const workflowKey of Object.keys(next.workflows) as CreateWorkflow[]) {
    const legacyWorkflow = parsed.workflows?.[workflowKey] || {};
    next.workflows[workflowKey].activeModel = legacyWorkflow.activeModel;

    const legacyDrafts = legacyWorkflow.drafts || {};
    for (const [modelId, draft] of Object.entries(legacyDrafts)) {
      next.workflows[workflowKey].drafts[modelId] = migrateDraft(workflowKey, modelId, draft);
    }
  }

  return next;
}

export function normalizeCreateDraftState(raw: unknown): UnifiedCreateDraftState {
  const defaultState = createDefaultUnifiedCreateDraftState();
  if (!raw || typeof raw !== 'object') return defaultState;

  const parsed = raw as any;
  if (parsed.version !== 2) {
    return migrateLegacyCreateDraftState(parsed);
  }

  const next = createDefaultUnifiedCreateDraftState();
  next.activeMode = parsed.activeMode || defaultState.activeMode;

  for (const workflowKey of Object.keys(next.workflows) as CreateWorkflow[]) {
    const workflow = parsed.workflows?.[workflowKey] || {};
    next.workflows[workflowKey].activeModel = workflow.activeModel;

    for (const [modelId, envelope] of Object.entries(workflow.drafts || {})) {
      const typedEnvelope = envelope as any;
      next.workflows[workflowKey].drafts[modelId] = {
        modelId,
        updatedAt: typeof typedEnvelope.updatedAt === 'number' ? typedEnvelope.updatedAt : Date.now(),
        draft: cloneState(typedEnvelope.draft ?? {}),
      };
    }
  }

  return next;
}

export function importLegacyDataUrlMedia<T extends UnifiedCreateDraftState>(state: T): T {
  return state;
}

export function hasLegacyDataUrlMedia(state: UnifiedCreateDraftState): boolean {
  for (const workflow of Object.values(state.workflows)) {
    for (const envelope of Object.values(workflow.drafts || {})) {
      const draft = envelope?.draft as any;
      if (!draft || typeof draft !== 'object') continue;
      if (typeof draft.previewUrl === 'string' && draft.previewUrl.startsWith('data:')) return true;
      if (typeof draft.previewUrl2 === 'string' && draft.previewUrl2.startsWith('data:')) return true;
    }
  }
  return false;
}
