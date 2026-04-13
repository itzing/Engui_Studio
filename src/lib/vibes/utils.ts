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
  const tokens = lower.split(/[^a-z0-9-]+/i).filter((token) => token.length >= 4);
  const stop = new Set(['with', 'that', 'this', 'from', 'into', 'about', 'there', 'their', 'scene', 'style', 'camera', 'focus', 'vibe', 'prompt', 'woman', 'young', 'man', 'person', 'girl', 'boy', 'sitting', 'standing', 'holding', 'wearing', 'train', 'station', 'bench', 'bag', 'tracks', 'locomotive']);
  const moodPriority = ['nostalgic', 'warm', 'wistful', 'dreamy', 'romantic', 'soft', 'gentle', 'misty', 'moody', 'elegant', 'cinematic', 'serene', 'melancholic', 'ethereal', 'pastel', 'vintage', 'victorian'];
  const detectedMoodTags = moodPriority.filter((tag) => lower.includes(tag));
  const tags = pickTopUnique([...detectedMoodTags, ...tokens.filter((token) => !stop.has(token))], 6);

  const sceneTypes: string[] = [];
  if (/portrait|close[- ]?up|headshot|character|woman|man|girl|boy/i.test(normalized)) sceneTypes.push('portrait');
  if (/landscape|environment|wide shot|panorama/i.test(normalized)) sceneTypes.push('landscape');
  if (/interior|room|inside/i.test(normalized)) sceneTypes.push('interior');
  if (/exterior|outside|street|outdoor|station|garden/i.test(normalized)) sceneTypes.push('exterior');
  if (/cinematic|film|movie/i.test(normalized)) sceneTypes.push('cinematic');

  const baseParts = [
    lower.includes('warm') ? 'warm' : '',
    lower.includes('nostalgic') ? 'nostalgic' : '',
    lower.includes('soft') || lower.includes('mist') ? 'soft misty atmosphere' : '',
    lower.includes('morning') ? 'morning light' : '',
    lower.includes('romantic') ? 'romantic tone' : '',
    lower.includes('wistful') ? 'quiet wistfulness' : '',
    lower.includes('victorian') || lower.includes('vintage') ? 'period elegance' : '',
    lower.includes('pastel') ? 'pastel delicacy' : '',
    lower.includes('cinematic') ? 'cinematic softness' : '',
  ].filter(Boolean);

  const baseDescription = baseParts.length > 0
    ? pickTopUnique(baseParts, 6).join(', ')
    : 'atmospheric visual mood, cinematic light, and reusable aesthetic tone';

  const nameParts = [
    lower.includes('nostalgic') ? 'Nostalgic' : '',
    lower.includes('warm') ? 'Warm' : '',
    lower.includes('morning') ? 'Morning' : '',
    lower.includes('mist') ? 'Mist' : '',
    lower.includes('victorian') ? 'Victorian' : '',
    lower.includes('romantic') ? 'Romantic' : '',
    'Vibe'
  ].filter(Boolean);
  const name = pickTopUnique(nameParts, 3).join(' ');

  return {
    name: name || 'Extracted Vibe',
    baseDescription,
    tags,
    compatibleSceneTypes: pickTopUnique(sceneTypes, 4),
    confidence: detectedMoodTags.length >= 2 ? 'medium' : 'low',
  };
}
