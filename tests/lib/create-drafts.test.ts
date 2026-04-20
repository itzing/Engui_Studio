import { beforeEach, describe, expect, it } from 'vitest';
import { getWorkflowActiveModel, getWorkflowDraft, loadCreateDraftState, saveWorkflowDraft, setActiveMode, setWorkflowActiveModel } from '@/lib/createDrafts';

function createStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

describe('createDrafts mobile persistence', () => {
  beforeEach(() => {
    const storage = createStorage();
    (globalThis as any).window = { localStorage: storage };
  });

  it('persists active model and draft snapshot per workflow/model', () => {
    setActiveMode('image');
    setWorkflowActiveModel('image', 'flux-krea');
    saveWorkflowDraft('image', 'flux-krea', { prompt: 'portrait', selectedSceneId: 'scene-1' });

    expect(getWorkflowActiveModel('image')).toBe('flux-krea');
    expect(getWorkflowDraft('image', 'flux-krea')).toMatchObject({
      prompt: 'portrait',
      selectedSceneId: 'scene-1',
    });

    const state = loadCreateDraftState();
    expect(state.activeMode).toBe('image');
    expect(state.workflows.image.activeModel).toBe('flux-krea');
  });
});
