import { beforeEach, describe, expect, it } from 'vitest';
import { collectReferencedMediaIds } from '@/lib/create/createMediaStore';
import { loadUnifiedCreateDraftState, saveUnifiedCreateDraftState, saveWorkflowDraftInState, setActiveModeInState, setWorkflowActiveModelInState } from '@/lib/create/createDraftStore';
import { createDefaultUnifiedCreateDraftState } from '@/lib/create/createDraftSchema';
import { migrateLegacyCreateDraftState } from '@/lib/create/createDraftMigrations';

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

describe('create draft store v2', () => {
  beforeEach(() => {
    const storage = createStorage();
    (globalThis as any).window = { localStorage: storage };
  });

  it('loads and saves v2 state', () => {
    let state = createDefaultUnifiedCreateDraftState();
    state = setActiveModeInState(state, 'image');
    state = setWorkflowActiveModelInState(state, 'image', 'flux-krea');
    state = saveWorkflowDraftInState(state, 'image', 'flux-krea', { prompt: 'test' });
    saveUnifiedCreateDraftState(state);

    const restored = loadUnifiedCreateDraftState();
    expect(restored.version).toBe(2);
    expect(restored.activeMode).toBe('image');
    expect(restored.workflows.image.activeModel).toBe('flux-krea');
    expect(restored.workflows.image.drafts['flux-krea']?.draft).toMatchObject({ prompt: 'test' });
  });

  it('migrates legacy v1 draft maps into envelopes and media refs', () => {
    const migrated = migrateLegacyCreateDraftState({
      version: 1,
      activeMode: 'image',
      workflows: {
        image: {
          activeModel: 'z-image',
          drafts: {
            'z-image': {
              prompt: 'portrait',
              previewUrl: 'https://example.com/a.png',
              previewUrl2: 'https://example.com/b.png',
            },
          },
        },
      },
    });

    expect(migrated.version).toBe(2);
    expect(migrated.workflows.image.activeModel).toBe('z-image');
    expect(migrated.workflows.image.drafts['z-image']?.draft).toMatchObject({
      prompt: 'portrait',
      inputs: {
        primary: { kind: 'remote-url', url: 'https://example.com/a.png' },
        secondary: { kind: 'remote-url', url: 'https://example.com/b.png' },
      },
    });
  });

  it('collects referenced indexeddb media ids from nested drafts', () => {
    const state = createDefaultUnifiedCreateDraftState();
    state.workflows.image.drafts['flux-krea'] = {
      modelId: 'flux-krea',
      updatedAt: 1,
      draft: {
        inputs: {
          primary: { kind: 'idb-media', mediaId: 'm1' },
          secondary: { kind: 'remote-url', url: 'https://example.com' },
        },
      },
    };
    state.workflows.video.drafts['wan22'] = {
      modelId: 'wan22',
      updatedAt: 2,
      draft: {
        inputs: {
          image: { kind: 'idb-media', mediaId: 'm2' },
        },
      },
    };

    expect(collectReferencedMediaIds(state)).toEqual(['m1', 'm2']);
  });

  it('preserves independent active models and drafts per workflow', () => {
    let state = createDefaultUnifiedCreateDraftState();
    state = setActiveModeInState(state, 'video');
    state = setWorkflowActiveModelInState(state, 'image', 'flux-krea');
    state = setWorkflowActiveModelInState(state, 'video', 'wan22');
    state = setWorkflowActiveModelInState(state, 'tts', 'elevenlabs-tts');
    state = setWorkflowActiveModelInState(state, 'music', 'elevenlabs-music');
    state = saveWorkflowDraftInState(state, 'image', 'flux-krea', { prompt: 'img prompt' });
    state = saveWorkflowDraftInState(state, 'video', 'wan22', { prompt: 'vid prompt', imagePreviewUrl: '/generations/frame.png' });
    state = saveWorkflowDraftInState(state, 'tts', 'elevenlabs-tts', { prompt: 'tts prompt', selectedVoice: 'voice-1' });
    state = saveWorkflowDraftInState(state, 'music', 'elevenlabs-music', { prompt: 'music prompt', duration: 60 });
    saveUnifiedCreateDraftState(state);

    const restored = loadUnifiedCreateDraftState();
    expect(restored.activeMode).toBe('video');
    expect(restored.workflows.image.activeModel).toBe('flux-krea');
    expect(restored.workflows.video.activeModel).toBe('wan22');
    expect(restored.workflows.tts.activeModel).toBe('elevenlabs-tts');
    expect(restored.workflows.music.activeModel).toBe('elevenlabs-music');
    expect(restored.workflows.video.drafts['wan22']?.draft).toMatchObject({ prompt: 'vid prompt' });
    expect(restored.workflows.tts.drafts['elevenlabs-tts']?.draft).toMatchObject({ selectedVoice: 'voice-1' });
    expect(restored.workflows.music.drafts['elevenlabs-music']?.draft).toMatchObject({ duration: 60 });
  });
});
