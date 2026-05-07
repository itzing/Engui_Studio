import { buildCharacterPromptFromSummary } from '@/lib/scenes/utils';
import { CHARACTER_PREVIEW_SLOTS, type CharacterPreviewSlot, type CharacterSummary } from './types';

export const DEFAULT_CHARACTER_PREVIEW_MODEL_ID = 'z-image';

export const CHARACTER_PREVIEW_SLOT_META: Record<CharacterPreviewSlot, {
  title: string;
  subtitle: string;
  groupIds: string[];
  width: number;
  height: number;
}> = {
  portrait: {
    title: 'Portrait preview',
    subtitle: 'Identity, face, and hair',
    groupIds: ['identity', 'face', 'hair'],
    width: 1024,
    height: 1024,
  },
  upper_body: {
    title: 'Upper-body preview',
    subtitle: 'Hair, body, and posture',
    groupIds: ['hair', 'body', 'posture'],
    width: 832,
    height: 1216,
  },
  full_body: {
    title: 'Full-body preview',
    subtitle: 'Body, lower body, and posture',
    groupIds: ['body', 'lower-body', 'posture'],
    width: 896,
    height: 1408,
  },
};

const SLOT_PROMPT_PREFIX: Record<CharacterPreviewSlot, string> = {
  portrait: 'studio character portrait, head and shoulders framing, direct readable facial features, clean lighting, single subject',
  upper_body: 'studio character reference, upper body framing, visible torso and arms, clear posture, single subject',
  full_body: 'studio character reference, full body framing, standing pose, complete silhouette visible, single subject',
};

const SLOT_PROMPT_SUFFIX: Record<CharacterPreviewSlot, string> = {
  portrait: 'high clarity identity reference, neutral background, no extra people, no cropped face',
  upper_body: 'clear anatomy reference, neutral background, no extra people, no cut off hands when possible',
  full_body: 'clear full figure reference, neutral background, no extra people, feet visible when possible',
};

export function normalizeCharacterPreviewSlot(input: unknown): CharacterPreviewSlot | null {
  return typeof input === 'string' && CHARACTER_PREVIEW_SLOTS.includes(input as CharacterPreviewSlot)
    ? input as CharacterPreviewSlot
    : null;
}

export function getCharacterPreviewSlotMeta(slot: CharacterPreviewSlot) {
  return CHARACTER_PREVIEW_SLOT_META[slot];
}

export function buildCharacterPreviewPrompt(character: CharacterSummary, slot: CharacterPreviewSlot): string {
  const appearancePrompt = buildCharacterPromptFromSummary(character, {
    includeName: false,
    includeGender: false,
  }).trim();

  return [
    SLOT_PROMPT_PREFIX[slot],
    appearancePrompt,
    SLOT_PROMPT_SUFFIX[slot],
  ]
    .filter(Boolean)
    .join(', ');
}
