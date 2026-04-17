import type { PoseCharacter, PoseExtractResult, PosePresetSource, PosePresetStatus, PosePresetSummary, PoseRelationship } from './types';

type PersistedPoseRecord = {
  id: string;
  workspaceId: string;
  name: string;
  characterCount: number;
  summary: string;
  posePrompt: string;
  tags: string | null;
  source: string;
  sourceImageUrl: string | null;
  modelHint: string | null;
  charactersJson: string;
  relationshipJson: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string');
    }
  } catch (error) {
    console.warn('Failed to parse pose JSON array:', error);
  }

  return [];
}

function parseCharacters(value: string | null | undefined): PoseCharacter[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is PoseCharacter => typeof item === 'object' && item !== null && typeof item.index === 'number');
    }
  } catch (error) {
    console.warn('Failed to parse pose characters JSON:', error);
  }

  return [];
}

function parseRelationship(value: string | null | undefined): PoseRelationship | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') {
      return {
        spatialLayout: typeof parsed.spatialLayout === 'string' ? parsed.spatialLayout : '',
        interaction: typeof parsed.interaction === 'string' ? parsed.interaction : '',
        contact: typeof parsed.contact === 'string' ? parsed.contact : '',
        symmetry: typeof parsed.symmetry === 'string' ? parsed.symmetry : '',
      };
    }
  } catch (error) {
    console.warn('Failed to parse pose relationship JSON:', error);
  }

  return null;
}

export function normalizePoseStatus(input: unknown): PosePresetStatus {
  return input === 'trash' ? 'trash' : 'active';
}

export function normalizePoseSource(input: unknown): PosePresetSource {
  return input === 'extracted' ? 'extracted' : 'manual';
}

export function normalizeCharacterCount(input: unknown): 1 | 2 | 3 {
  if (input === 2 || input === '2') return 2;
  if (input === 3 || input === '3') return 3;
  return 1;
}

export function normalizeChipArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  const normalized = input
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().replace(/\s+/g, ' ').toLowerCase())
    .filter(Boolean);

  return Array.from(new Set(normalized));
}

export function serializeChipArray(input: unknown): string {
  return JSON.stringify(normalizeChipArray(input));
}

export function normalizePoseCharacter(input: unknown, fallbackIndex: number): PoseCharacter {
  const value = (input && typeof input === 'object') ? input as Record<string, unknown> : {};

  return {
    index: typeof value.index === 'number' ? value.index : fallbackIndex,
    label: typeof value.label === 'string' && value.label.trim() ? value.label.trim() : null,
    orientation: typeof value.orientation === 'string' ? value.orientation.trim() : '',
    head: typeof value.head === 'string' ? value.head.trim() : '',
    gaze: typeof value.gaze === 'string' ? value.gaze.trim() : '',
    torso: typeof value.torso === 'string' ? value.torso.trim() : '',
    armsHands: typeof value.armsHands === 'string' ? value.armsHands.trim() : '',
    legsStance: typeof value.legsStance === 'string' ? value.legsStance.trim() : '',
    expression: typeof value.expression === 'string' && value.expression.trim() ? value.expression.trim() : null,
  };
}

export function normalizePoseCharacters(input: unknown, characterCount: 1 | 2 | 3): PoseCharacter[] {
  const source = Array.isArray(input) ? input : [];
  const normalized = source.slice(0, characterCount).map((item, index) => normalizePoseCharacter(item, index));

  while (normalized.length < characterCount) {
    normalized.push(normalizePoseCharacter({}, normalized.length));
  }

  return normalized;
}

export function normalizePoseRelationship(input: unknown, characterCount: 1 | 2 | 3): PoseRelationship | null {
  if (characterCount === 1) return null;
  const value = (input && typeof input === 'object') ? input as Record<string, unknown> : {};

  return {
    spatialLayout: typeof value.spatialLayout === 'string' ? value.spatialLayout.trim() : '',
    interaction: typeof value.interaction === 'string' ? value.interaction.trim() : '',
    contact: typeof value.contact === 'string' ? value.contact.trim() : '',
    symmetry: typeof value.symmetry === 'string' ? value.symmetry.trim() : '',
  };
}

export function serializePoseCharacters(input: unknown, characterCount: 1 | 2 | 3): string {
  return JSON.stringify(normalizePoseCharacters(input, characterCount));
}

export function serializePoseRelationship(input: unknown, characterCount: 1 | 2 | 3): string | null {
  const relationship = normalizePoseRelationship(input, characterCount);
  return relationship ? JSON.stringify(relationship) : null;
}

export function toPoseSummary(record: PersistedPoseRecord): PosePresetSummary {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    name: record.name,
    characterCount: normalizeCharacterCount(record.characterCount),
    summary: record.summary,
    posePrompt: record.posePrompt,
    tags: parseJsonArray(record.tags),
    source: normalizePoseSource(record.source),
    sourceImageUrl: record.sourceImageUrl ?? null,
    modelHint: record.modelHint ?? null,
    characters: parseCharacters(record.charactersJson),
    relationship: parseRelationship(record.relationshipJson),
    status: normalizePoseStatus(record.status),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function buildPosePrompt(characters: PoseCharacter[], relationship: PoseRelationship | null): string {
  const characterParts = characters.map((character, index) => {
    const prefix = characters.length === 1 ? 'one character' : `character ${index + 1}`;
    return [
      prefix,
      character.orientation,
      character.head,
      character.gaze,
      character.torso,
      character.armsHands,
      character.legsStance,
      character.expression,
    ].filter(Boolean).join(', ');
  });

  const relationshipPart = relationship
    ? [relationship.spatialLayout, relationship.interaction, relationship.contact, relationship.symmetry].filter(Boolean).join(', ')
    : '';

  return [...characterParts, relationshipPart].filter(Boolean).join(', ');
}

export function heuristicExtractPose(_prompt: string): PoseExtractResult {
  const characters = normalizePoseCharacters([{}], 1);
  const posePrompt = buildPosePrompt(characters, null) || 'one character, neutral standing pose';

  return {
    characterCount: 1,
    summary: 'Single character pose',
    posePrompt,
    tags: ['single'],
    characters,
    relationship: null,
    confidence: 'low',
  };
}
