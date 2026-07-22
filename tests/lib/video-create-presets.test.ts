/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createVideoCreatePreset,
  deleteVideoCreatePreset,
  loadVideoCreatePresets,
  saveVideoCreatePresets,
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
      existingPresets: [makePreset('existing', 100)],
      snapshot: {
        prompt: 'move forward',
        showAdvanced: false,
        parameterValues: { length: 121, seed: 42 },
      },
    });

    expect(preset).toMatchObject({
      id: 'video-preset-1234-i',
      modelId: 'wan22',
      name: 'Preset 2',
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
});
