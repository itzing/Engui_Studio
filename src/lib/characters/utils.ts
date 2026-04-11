import type { CharacterEditorState, CharacterTraitMap, CharacterSummary, CharacterVersionSummary } from './types';

type PersistedCharacterRecord = {
  id: string;
  name: string;
  gender: string | null;
  traits: string | null;
  editorState: string | null;
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

  const entries = Object.entries(input as Record<string, unknown>)
    .filter(([key, value]) => typeof key === 'string' && key.trim() && typeof value === 'string')
    .map(([key, value]) => [key.trim(), value.trim()])
    .filter(([key, value]) => key.length > 0 && value.length > 0);

  return Object.fromEntries(entries);
}

export function normalizeEditorState(input: unknown): CharacterEditorState {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  return input as CharacterEditorState;
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

export function toCharacterSummary(record: PersistedCharacterRecord): CharacterSummary {
  return {
    id: record.id,
    name: record.name,
    gender: record.gender,
    traits: parseJsonObject<CharacterTraitMap>(record.traits),
    editorState: parseJsonObject<CharacterEditorState>(record.editorState),
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
