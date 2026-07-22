/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createVideoCreatePreset,
  deleteVideoCreatePreset,
  loadVideoCreatePresets,
  saveVideoCreatePresets,
  shouldClearMissingVideoCreatePresetSelection,
  updateVideoCreatePresetSnapshot,
  upsertVideoCreatePreset,
  type VideoCreatePreset,
} from '@/lib/create/videoPresets';

const makePreset = (id: string, updatedAt: number): VideoCreatePreset => ({
  id,
  modelId: 'wan22',
  name: id,
  prompt: `prompt ${id}`,
  showAdvanced: true,
  parameterValues: { length: 81 },
  createdAt: updatedAt,
  updatedAt,
});

describe('video create presets', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('loads presets sorted by latest update', () => {
    saveVideoCreatePresets([makePreset('old', 100), makePreset('new', 200)]);

    expect(loadVideoCreatePresets().map((preset) => preset.id)).toEqual(['new', 'old']);
  });

  it('creates a model-scoped preset from the current snapshot', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const preset = createVideoCreatePreset({
      modelId: 'wan22',
      name: '  Cinematic move  ',
      snapshot: {
        prompt: 'move forward',
        showAdvanced: false,
        parameterValues: { length: 121, seed: 42 },
      },
    });

    expect(preset).toMatchObject({
      id: 'video-preset-1234-i',
      modelId: 'wan22',
      name: 'Cinematic move',
      prompt: 'move forward',
      showAdvanced: false,
      parameterValues: { length: 121, seed: 42 },
    });
  });

  it('upserts and deletes presets in local storage', () => {
    const first = makePreset('first', 100);
    const second = makePreset('second', 200);

    upsertVideoCreatePreset(first, []);
    upsertVideoCreatePreset(second, loadVideoCreatePresets());

    expect(loadVideoCreatePresets().map((preset) => preset.id)).toEqual(['second', 'first']);

    deleteVideoCreatePreset('second', loadVideoCreatePresets());

    expect(loadVideoCreatePresets().map((preset) => preset.id)).toEqual(['first']);
  });

  it('updates an existing preset snapshot without changing its identity or name', () => {
    const updated = updateVideoCreatePresetSnapshot({
      preset: makePreset('saved', 100),
      snapshot: {
        prompt: 'new camera move',
        showAdvanced: false,
        parameterValues: { length: 121, seed: 7 },
      },
      now: 300,
    });

    expect(updated).toMatchObject({
      id: 'saved',
      name: 'saved',
      prompt: 'new camera move',
      showAdvanced: false,
      parameterValues: { length: 121, seed: 7 },
      createdAt: 100,
      updatedAt: 300,
    });
  });

  it('does not clear a restored selection before presets hydrate', () => {
    expect(shouldClearMissingVideoCreatePresetSelection({
      selectedPresetId: 'saved',
      presets: [],
      presetsHydrated: false,
    })).toBe(false);

    expect(shouldClearMissingVideoCreatePresetSelection({
      selectedPresetId: 'saved',
      presets: [makePreset('saved', 100)],
      presetsHydrated: true,
    })).toBe(false);

    expect(shouldClearMissingVideoCreatePresetSelection({
      selectedPresetId: 'missing',
      presets: [makePreset('saved', 100)],
      presetsHydrated: true,
    })).toBe(true);
  });
});
