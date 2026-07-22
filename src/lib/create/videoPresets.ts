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
const VIDEO_PRESETS_API_PATH = '/api/create/video-presets';

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

export function clearLocalVideoCreatePresets() {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(VIDEO_PRESETS_STORAGE_KEY);
}

export function createVideoCreatePreset(input: {
  modelId: string;
  name: string;
  snapshot: VideoCreatePresetSnapshot;
  now?: number;
}): VideoCreatePreset {
  const now = input.now ?? Date.now();

  return {
    id: `video-preset-${now}-${Math.random().toString(36).slice(2, 8)}`,
    modelId: input.modelId,
    name: input.name.trim(),
    prompt: input.snapshot.prompt,
    showAdvanced: input.snapshot.showAdvanced,
    parameterValues: { ...input.snapshot.parameterValues },
    createdAt: now,
    updatedAt: now,
  };
}

export function updateVideoCreatePresetSnapshot(input: {
  preset: VideoCreatePreset;
  snapshot: VideoCreatePresetSnapshot;
  now?: number;
}): VideoCreatePreset {
  return {
    ...input.preset,
    prompt: input.snapshot.prompt,
    showAdvanced: input.snapshot.showAdvanced,
    parameterValues: { ...input.snapshot.parameterValues },
    updatedAt: input.now ?? Date.now(),
  };
}

export function upsertVideoCreatePreset(preset: VideoCreatePreset, presets = loadVideoCreatePresets()): VideoCreatePreset[] {
  const withoutCurrent = presets.filter((entry) => entry.id !== preset.id);
  const next = [{ ...preset }, ...withoutCurrent].sort((a, b) => b.updatedAt - a.updatedAt);
  saveVideoCreatePresets(next);
  return next;
}

export function deleteVideoCreatePreset(presetId: string, presets = loadVideoCreatePresets()): VideoCreatePreset[] {
  const next = presets.filter((preset) => preset.id !== presetId);
  saveVideoCreatePresets(next);
  return next;
}

function buildVideoPresetQuery(workspaceId: string, modelId?: string) {
  const params = new URLSearchParams({ workspaceId });
  if (modelId) params.set('modelId', modelId);
  return params.toString();
}

function normalizePresetList(value: unknown): VideoCreatePreset[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizePreset)
    .filter((preset): preset is VideoCreatePreset => !!preset)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

async function readPresetResponse(response: Response): Promise<VideoCreatePreset[]> {
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to sync video presets');
  }
  return normalizePresetList(data.presets);
}

export async function fetchVideoCreatePresets(input: { workspaceId: string; modelId?: string }): Promise<VideoCreatePreset[]> {
  const response = await fetch(`${VIDEO_PRESETS_API_PATH}?${buildVideoPresetQuery(input.workspaceId, input.modelId)}`, {
    cache: 'no-store',
  });
  return readPresetResponse(response);
}

export async function syncVideoCreatePresets(input: {
  workspaceId: string;
  presets: VideoCreatePreset[];
}): Promise<VideoCreatePreset[]> {
  const response = await fetch(VIDEO_PRESETS_API_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      presets: input.presets,
    }),
  });
  return readPresetResponse(response);
}

export async function saveServerVideoCreatePreset(input: {
  workspaceId: string;
  preset: VideoCreatePreset;
}): Promise<VideoCreatePreset[]> {
  const response = await fetch(VIDEO_PRESETS_API_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      preset: input.preset,
    }),
  });
  return readPresetResponse(response);
}

export async function deleteServerVideoCreatePreset(input: {
  workspaceId: string;
  presetId: string;
}): Promise<VideoCreatePreset[]> {
  const response = await fetch(`${VIDEO_PRESETS_API_PATH}/${encodeURIComponent(input.presetId)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId: input.workspaceId }),
  });
  return readPresetResponse(response);
}

export function shouldClearMissingVideoCreatePresetSelection(input: {
  selectedPresetId: string;
  presets: VideoCreatePreset[];
  presetsHydrated: boolean;
}): boolean {
  if (!input.selectedPresetId || !input.presetsHydrated) return false;
  return !input.presets.some((preset) => preset.id === input.selectedPresetId);
}
