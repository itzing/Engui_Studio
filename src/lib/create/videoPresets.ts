'use client';

export type VideoCreatePresetSnapshot = {
  prompt: string;
  showAdvanced: boolean;
  parameterValues: Record<string, unknown>;
};

export type VideoCreatePreset = VideoCreatePresetSnapshot & {
  id: string;
  modelId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

const VIDEO_PRESETS_STORAGE_KEY = 'engui.create.video.presets.v1';

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizePreset(value: unknown): VideoCreatePreset | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : '';
  const modelId = typeof value.modelId === 'string' && value.modelId.trim() ? value.modelId.trim() : '';
  const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : '';
  if (!id || !modelId || !name) return null;

  return {
    id,
    modelId,
    name,
    prompt: typeof value.prompt === 'string' ? value.prompt : '',
    showAdvanced: value.showAdvanced === true,
    parameterValues: isRecord(value.parameterValues) ? value.parameterValues : {},
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : Date.now(),
  };
}

export function loadVideoCreatePresets(): VideoCreatePreset[] {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(VIDEO_PRESETS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizePreset)
      .filter((preset): preset is VideoCreatePreset => !!preset)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function saveVideoCreatePresets(presets: VideoCreatePreset[]) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(VIDEO_PRESETS_STORAGE_KEY, JSON.stringify(presets));
}

export function createVideoCreatePreset(input: {
  modelId: string;
  snapshot: VideoCreatePresetSnapshot;
  existingPresets?: VideoCreatePreset[];
  now?: number;
}): VideoCreatePreset {
  const now = input.now ?? Date.now();
  const countForModel = (input.existingPresets || []).filter((preset) => preset.modelId === input.modelId).length;
  const name = `Preset ${countForModel + 1}`;

  return {
    id: `video-preset-${now}-${Math.random().toString(36).slice(2, 8)}`,
    modelId: input.modelId,
    name,
    prompt: input.snapshot.prompt,
    showAdvanced: input.snapshot.showAdvanced,
    parameterValues: { ...input.snapshot.parameterValues },
    createdAt: now,
    updatedAt: now,
  };
}

export function upsertVideoCreatePreset(preset: VideoCreatePreset, presets = loadVideoCreatePresets()): VideoCreatePreset[] {
  const withoutCurrent = presets.filter((entry) => entry.id !== preset.id);
  const next = [{ ...preset, updatedAt: Date.now() }, ...withoutCurrent];
  saveVideoCreatePresets(next);
  return next;
}

export function deleteVideoCreatePreset(presetId: string, presets = loadVideoCreatePresets()): VideoCreatePreset[] {
  const next = presets.filter((preset) => preset.id !== presetId);
  saveVideoCreatePresets(next);
  return next;
}
