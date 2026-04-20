'use client';

import {
  loadUnifiedCreateDraftState,
  saveUnifiedCreateDraftState,
  saveWorkflowDraftInState,
  setActiveModeInState,
  setWorkflowActiveModelInState,
} from '@/lib/create/createDraftStore';
import type { CreateWorkflow, UnifiedCreateDraftState } from '@/lib/create/createDraftSchema';

export type CreateMode = CreateWorkflow;

type WorkflowDraftState = {
  activeModel?: string;
  drafts?: Record<string, any>;
};

export type CreateDraftState = {
  version: 1;
  activeMode: CreateMode;
  workflows: Record<CreateMode, WorkflowDraftState>;
};

const defaultState = (): CreateDraftState => ({
  version: 1,
  activeMode: 'image',
  workflows: {
    image: { activeModel: undefined, drafts: {} },
    video: { activeModel: undefined, drafts: {} },
    tts: { activeModel: undefined, drafts: {} },
    music: { activeModel: undefined, drafts: {} },
  },
});

function fromUnifiedState(state: UnifiedCreateDraftState): CreateDraftState {
  return {
    version: 1,
    activeMode: state.activeMode,
    workflows: {
      image: {
        activeModel: state.workflows.image.activeModel,
        drafts: Object.fromEntries(Object.entries(state.workflows.image.drafts).map(([modelId, envelope]) => [modelId, envelope.draft])),
      },
      video: {
        activeModel: state.workflows.video.activeModel,
        drafts: Object.fromEntries(Object.entries(state.workflows.video.drafts).map(([modelId, envelope]) => [modelId, envelope.draft])),
      },
      tts: {
        activeModel: state.workflows.tts.activeModel,
        drafts: Object.fromEntries(Object.entries(state.workflows.tts.drafts).map(([modelId, envelope]) => [modelId, envelope.draft])),
      },
      music: {
        activeModel: state.workflows.music.activeModel,
        drafts: Object.fromEntries(Object.entries(state.workflows.music.drafts).map(([modelId, envelope]) => [modelId, envelope.draft])),
      },
    },
  };
}

export const loadCreateDraftState = (): CreateDraftState => {
  try {
    return fromUnifiedState(loadUnifiedCreateDraftState());
  } catch {
    return defaultState();
  }
};

export const saveCreateDraftState = (state: CreateDraftState) => {
  let next = loadUnifiedCreateDraftState();
  next = setActiveModeInState(next, state.activeMode);

  for (const workflow of Object.keys(state.workflows) as CreateMode[]) {
    const activeModel = state.workflows[workflow]?.activeModel;
    if (activeModel) {
      next = setWorkflowActiveModelInState(next, workflow, activeModel);
    }

    for (const [modelId, draft] of Object.entries(state.workflows[workflow]?.drafts || {})) {
      next = saveWorkflowDraftInState(next, workflow, modelId, draft);
    }
  }

  saveUnifiedCreateDraftState(next);
};

export const getActiveMode = (): CreateMode => loadCreateDraftState().activeMode;

export const setActiveMode = (mode: CreateMode) => {
  const next = setActiveModeInState(loadUnifiedCreateDraftState(), mode);
  saveUnifiedCreateDraftState(next);
};

export const getWorkflowActiveModel = (mode: CreateMode): string | undefined => {
  return loadUnifiedCreateDraftState().workflows[mode]?.activeModel;
};

export const setWorkflowActiveModel = (mode: CreateMode, modelId: string) => {
  const next = setWorkflowActiveModelInState(loadUnifiedCreateDraftState(), mode, modelId);
  saveUnifiedCreateDraftState(next);
};

export const getWorkflowDraft = <T = any>(mode: CreateMode, modelId: string): T | null => {
  const envelope = loadUnifiedCreateDraftState().workflows[mode]?.drafts?.[modelId];
  return (envelope?.draft as T) || null;
};

export const saveWorkflowDraft = <T = any>(mode: CreateMode, modelId: string, draft: T) => {
  const next = saveWorkflowDraftInState(loadUnifiedCreateDraftState(), mode, modelId, draft);
  saveUnifiedCreateDraftState(next);
};
