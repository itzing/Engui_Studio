import { characterTraitDefinitions } from '@/lib/characters/schema';
import { formatCharacterAge, resolveRenderedGender } from '@/lib/prompt-constructor/templates/sceneTemplateV2';
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
    subtitle: 'Identity, face, hair, body, and posture',
    groupIds: ['identity', 'face', 'hair', 'body', 'posture'],
    width: 832,
    height: 1216,
  },
  full_body: {
    title: 'Full-body preview',
    subtitle: 'Identity, face, hair, body, lower body, and posture',
    groupIds: ['identity', 'face', 'hair', 'body', 'lower-body', 'posture'],
    width: 896,
    height: 1408,
  },
};

const SLOT_PROMPT_PREFIX: Record<CharacterPreviewSlot, string> = {
  portrait: 'photorealistic studio character portrait, head and shoulders framing, direct readable facial features, clean lighting, single real person',
  upper_body: 'photorealistic studio character reference, upper body framing, visible face, torso and arms, clear posture, single real person',
  full_body: 'photorealistic studio character reference photo, full body framing, standing natural pose, face visible, complete clothed human figure visible, single real person',
};

const SLOT_PROMPT_SUFFIX: Record<CharacterPreviewSlot, string> = {
  portrait: 'high clarity identity reference, neutral background, no extra people, no cropped face, not a 3d render, not a mannequin, not a doll, not a model sheet',
  upper_body: 'clear identity and anatomy reference, neutral background, no extra people, no cut off hands when possible, not a different person, not a 3d render, not a mannequin, not a doll',
  full_body: 'normal character preview photo, clear identity and full figure reference, neutral background, no extra people, feet visible when possible, natural skin texture, normal face, normal clothing or neutral fitted outfit, not a 3d render, not a mannequin, not a doll, not a faceless body, not a black silhouette, not a model sheet, not a statue',
};

export function normalizeCharacterPreviewSlot(input: unknown): CharacterPreviewSlot | null {
  return typeof input === 'string' && CHARACTER_PREVIEW_SLOTS.includes(input as CharacterPreviewSlot)
    ? input as CharacterPreviewSlot
    : null;
}

export function getCharacterPreviewSlotMeta(slot: CharacterPreviewSlot) {
  return CHARACTER_PREVIEW_SLOT_META[slot];
}

function getPreviewTraitKeys(slot: CharacterPreviewSlot): string[] {
  const groupIds = new Set(CHARACTER_PREVIEW_SLOT_META[slot].groupIds);
  return characterTraitDefinitions
    .filter((definition) => groupIds.has(definition.group))
    .map((definition) => definition.key);
}

export function buildCharacterPreviewPrompt(character: CharacterSummary, slot: CharacterPreviewSlot): string {
  const ageValue = character.traits.age || '';
  const formattedAge = formatCharacterAge(ageValue);
  const formattedGender = resolveRenderedGender(character.gender || '', ageValue);
  const appearancePrompt = buildCharacterPromptFromSummary(character, {
    includeName: false,
    includeGender: false,
    includeTraitKeys: getPreviewTraitKeys(slot),
    excludeTraitKeys: ['age'],
  }).trim();

  return [
    SLOT_PROMPT_PREFIX[slot],
    formattedAge,
    formattedGender,
    appearancePrompt,
    SLOT_PROMPT_SUFFIX[slot],
  ]
    .filter(Boolean)
    .join(', ');
}
