'use client';

export type CreateMode = 'image' | 'video' | 'tts' | 'music';

type WorkflowDraftState = {
  activeModel?: string;
  drafts?: Record<string, any>;
};

export type CreateDraftState = {
  version: 1;
  activeMode: CreateMode;
  workflows: Record<CreateMode, WorkflowDraftState>;
};

const STORAGE_KEY = 'engui.create.state.v1';

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

export const loadCreateDraftState = (): CreateDraftState => {
  if (typeof window === 'undefined') return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      ...defaultState(),
      ...parsed,
      workflows: {
        ...defaultState().workflows,
        ...(parsed.workflows || {}),
      },
    };
  } catch {
    return defaultState();
  }
};

export const saveCreateDraftState = (state: CreateDraftState) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const getActiveMode = (): CreateMode => loadCreateDraftState().activeMode;

export const setActiveMode = (mode: CreateMode) => {
  const state = loadCreateDraftState();
  state.activeMode = mode;
  saveCreateDraftState(state);
};

export const getWorkflowActiveModel = (mode: CreateMode): string | undefined => {
  return loadCreateDraftState().workflows[mode]?.activeModel;
};

export const setWorkflowActiveModel = (mode: CreateMode, modelId: string) => {
  const state = loadCreateDraftState();
  state.workflows[mode] = state.workflows[mode] || { drafts: {} };
  state.workflows[mode].activeModel = modelId;
  saveCreateDraftState(state);
};

export const getWorkflowDraft = <T = any>(mode: CreateMode, modelId: string): T | null => {
  const state = loadCreateDraftState();
  return (state.workflows[mode]?.drafts?.[modelId] as T) || null;
};

export const saveWorkflowDraft = <T = any>(mode: CreateMode, modelId: string, draft: T) => {
  const state = loadCreateDraftState();
  state.workflows[mode] = state.workflows[mode] || { drafts: {} };
  state.workflows[mode].activeModel = modelId;
  state.workflows[mode].drafts = state.workflows[mode].drafts || {};
  state.workflows[mode].drafts![modelId] = draft;
  saveCreateDraftState(state);
};
