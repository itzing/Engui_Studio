import {
  CHARACTER_PREVIEW_SLOTS,
  type CharacterEditorState,
  type CharacterPreviewSlot,
  type CharacterPreviewSlotState,
  type CharacterPreviewState,
  type CharacterSummary,
  type CharacterTraitMap,
  type CharacterVersionSummary,
} from './types';

export function normalizeCharacterGender(input: unknown, fallback: string | null = 'female'): string | null {
  if (typeof input !== 'string') {
    return fallback;
  }

  const normalized = input.trim().toLowerCase();
  if (normalized === 'male' || normalized === 'female') {
    return normalized;
  }

  if (normalized === 'man') {
    return 'male';
  }

  if (normalized === 'woman') {
    return 'female';
  }

  return fallback;
}

type PersistedCharacterRecord = {
  id: string;
  name: string;
  gender: string | null;
  traits: string | null;
  editorState: string | null;
  previewStateJson?: string | null;
  currentVersionId: string | null;
  previewStatusSummary: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  _count?: {
    versions?: number;
  };
};

type PersistedCharacterVersionRecord = {
  id: string;
  characterId: string;
  traitsSnapshot: string | null;
  editorStateSnapshot: string | null;
  versionNumber: number;
  changeSummary: string;
  createdAt: Date;
};

function parseJsonObject<T extends Record<string, unknown>>(value: string | null | undefined): T {
  if (!value) return {} as T;

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as T;
    }
  } catch (error) {
    console.warn('Failed to parse persisted character JSON payload:', error);
  }

  return {} as T;
}

export function normalizeTraits(input: unknown): CharacterTraitMap {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  const normalizedEntries: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof key !== 'string' || typeof value !== 'string') {
      continue;
    }

    const normalizedKey = key.trim();
    const normalizedValue = value.trim();
    if (!normalizedKey || !normalizedValue) {
      continue;
    }

    normalizedEntries.push([normalizedKey, normalizedValue]);
  }

  return Object.fromEntries(normalizedEntries);
}

export function normalizeEditorState(input: unknown): CharacterEditorState {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  return input as CharacterEditorState;
}

function createEmptyPreviewSlotState(slot: CharacterPreviewSlot): CharacterPreviewSlotState {
  return {
    slot,
    status: 'idle',
    jobId: null,
    imageUrl: null,
    previewUrl: null,
    thumbnailUrl: null,
    error: null,
    promptSnapshot: null,
    updatedAt: null,
  };
}

export function createEmptyCharacterPreviewState(): CharacterPreviewState {
  return {
    portrait: createEmptyPreviewSlotState('portrait'),
    upper_body: createEmptyPreviewSlotState('upper_body'),
    full_body: createEmptyPreviewSlotState('full_body'),
  };
}

function normalizePreviewSlotState(slot: CharacterPreviewSlot, input: unknown): CharacterPreviewSlotState {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return createEmptyPreviewSlotState(slot);
  }

  const record = input as Record<string, unknown>;
  const status = typeof record.status === 'string' && ['idle', 'queued', 'running', 'ready', 'failed'].includes(record.status)
    ? record.status as CharacterPreviewSlotState['status']
    : 'idle';

  return {
    slot,
    status,
    jobId: typeof record.jobId === 'string' && record.jobId.trim() ? record.jobId.trim() : null,
    imageUrl: typeof record.imageUrl === 'string' && record.imageUrl.trim() ? record.imageUrl.trim() : null,
    previewUrl: typeof record.previewUrl === 'string' && record.previewUrl.trim() ? record.previewUrl.trim() : null,
    thumbnailUrl: typeof record.thumbnailUrl === 'string' && record.thumbnailUrl.trim() ? record.thumbnailUrl.trim() : null,
    error: typeof record.error === 'string' && record.error.trim() ? record.error.trim() : null,
    promptSnapshot: typeof record.promptSnapshot === 'string' && record.promptSnapshot.trim() ? record.promptSnapshot : null,
    updatedAt: typeof record.updatedAt === 'string' && record.updatedAt.trim() ? record.updatedAt.trim() : null,
  };
}

export function normalizeCharacterPreviewState(input: unknown): CharacterPreviewState {
  const baseState = createEmptyCharacterPreviewState();
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return baseState;
  }

  const raw = input as Record<string, unknown>;
  for (const slot of CHARACTER_PREVIEW_SLOTS) {
    baseState[slot] = normalizePreviewSlotState(slot, raw[slot]);
  }

  return baseState;
}

export function buildChangeSummary(previousTraits: CharacterTraitMap, nextTraits: CharacterTraitMap): string {
  const keys = Array.from(new Set([...Object.keys(previousTraits), ...Object.keys(nextTraits)])).sort();
  const changes: string[] = [];

  for (const key of keys) {
    const previousValue = previousTraits[key];
    const nextValue = nextTraits[key];

    if (previousValue === nextValue) continue;

    if (previousValue && nextValue) {
      changes.push(`${key}: ${previousValue} → ${nextValue}`);
      continue;
    }

    if (!previousValue && nextValue) {
      changes.push(`${key}: ∅ → ${nextValue}`);
      continue;
    }

    if (previousValue && !nextValue) {
      changes.push(`${key}: ${previousValue} → ∅`);
    }
  }

  return changes.length > 0 ? changes.join('; ') : 'Initial character snapshot';
}

export function serializeTraits(traits: CharacterTraitMap): string {
  return JSON.stringify(normalizeTraits(traits));
}

export function serializeEditorState(editorState: CharacterEditorState): string {
  return JSON.stringify(normalizeEditorState(editorState));
}

export function serializeCharacterPreviewState(previewState: CharacterPreviewState): string {
  return JSON.stringify(normalizeCharacterPreviewState(previewState));
}

export function toCharacterSummary(record: PersistedCharacterRecord): CharacterSummary {
  const previewState = normalizeCharacterPreviewState(parseJsonObject<Record<string, unknown>>(record.previewStateJson));
  const primaryPreview = previewState.portrait;

  return {
    id: record.id,
    name: record.name,
    gender: record.gender,
    traits: parseJsonObject<CharacterTraitMap>(record.traits),
    editorState: parseJsonObject<CharacterEditorState>(record.editorState),
    previewState,
    primaryPreviewImageUrl: primaryPreview.imageUrl,
    primaryPreviewThumbnailUrl: primaryPreview.thumbnailUrl || primaryPreview.previewUrl || primaryPreview.imageUrl,
    currentVersionId: record.currentVersionId,
    previewStatusSummary: record.previewStatusSummary,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deletedAt: record.deletedAt ? record.deletedAt.toISOString() : null,
    versionCount: record._count?.versions,
  };
}

export function toCharacterVersionSummary(record: PersistedCharacterVersionRecord): CharacterVersionSummary {
  return {
    id: record.id,
    characterId: record.characterId,
    traitsSnapshot: parseJsonObject<CharacterTraitMap>(record.traitsSnapshot),
    editorStateSnapshot: parseJsonObject<CharacterEditorState>(record.editorStateSnapshot),
    versionNumber: record.versionNumber,
    changeSummary: record.changeSummary,
    createdAt: record.createdAt.toISOString(),
  };
}
