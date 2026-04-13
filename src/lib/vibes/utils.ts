import type { VibeExtractResult, VibePresetSummary, VibePresetStatus } from './types';

type PersistedVibeRecord = {
  id: string;
  name: string;
  baseDescription: string;
  tags: string | null;
  compatibleSceneTypes: string | null;
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
    console.warn('Failed to parse vibe JSON array:', error);
  }

  return [];
}

export function normalizeChipArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const normalized = input
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().replace(/\s+/g, ' ').toLowerCase())
    .filter(Boolean);

  return Array.from(new Set(normalized));
}

export function normalizeStatus(input: unknown): VibePresetStatus {
  return input === 'trash' ? 'trash' : 'active';
}

export function serializeChipArray(input: unknown): string {
  return JSON.stringify(normalizeChipArray(input));
}

export function toVibeSummary(record: PersistedVibeRecord): VibePresetSummary {
  return {
    id: record.id,
    name: record.name,
    baseDescription: record.baseDescription,
    tags: parseJsonArray(record.tags),
    compatibleSceneTypes: parseJsonArray(record.compatibleSceneTypes),
    status: normalizeStatus(record.status),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function pickTopUnique(values: string[], limit: number): string[] {
  return Array.from(new Set(values)).slice(0, limit);
}

export function heuristicExtractVibe(prompt: string): VibeExtractResult {
  const trimmed = prompt.trim();
  const normalized = trimmed.replace(/\s+/g, ' ');
  const lower = normalized.toLowerCase();
  const tokens = lower.split(/[^a-z0-9]+/i).filter((token) => token.length >= 4);
  const stop = new Set(['with', 'that', 'this', 'from', 'into', 'about', 'there', 'their', 'scene', 'style', 'mood', 'light', 'lighting', 'camera', 'focus', 'vibe', 'prompt']);
  const tags = pickTopUnique(tokens.filter((token) => !stop.has(token)), 6);

  const sceneTypes: string[] = [];
  if (/portrait|close[- ]?up|headshot|character/i.test(normalized)) sceneTypes.push('portrait');
  if (/landscape|environment|wide shot|panorama/i.test(normalized)) sceneTypes.push('landscape');
  if (/interior|room|inside/i.test(normalized)) sceneTypes.push('interior');
  if (/exterior|outside|street|outdoor/i.test(normalized)) sceneTypes.push('exterior');
  if (/cinematic|film|movie/i.test(normalized)) sceneTypes.push('cinematic');

  const firstSentence = normalized.split(/[.!?\n]/).map((part) => part.trim()).find(Boolean) || normalized;
  const rawName = firstSentence.split(/,| with | featuring /i)[0].trim();
  const safeName = rawName.slice(0, 60).replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '');
  const name = safeName ? safeName.replace(/\b\w/g, (char) => char.toUpperCase()) : 'Extracted Vibe';

  return {
    name,
    baseDescription: normalized,
    tags,
    compatibleSceneTypes: pickTopUnique(sceneTypes, 4),
    confidence: normalized.length > 80 ? 'medium' : 'low',
  };
}
