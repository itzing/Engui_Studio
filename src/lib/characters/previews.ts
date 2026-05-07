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
  portrait: 'studio character portrait photo, head and shoulders framing, direct readable facial features, clean lighting, single person',
  upper_body: 'studio character reference photo, upper body framing, visible face, torso and arms, clear posture, single person',
  full_body: 'studio character reference photo, full body framing, standing natural pose, face visible, complete clothed human figure visible, single person',
};

const SLOT_PROMPT_SUFFIX: Record<CharacterPreviewSlot, string> = {
  portrait: 'high clarity identity reference, neutral background, no extra people, face fully visible',
  upper_body: 'clear identity and anatomy reference, neutral background, no extra people, hands visible when possible',
  full_body: 'normal character preview photo, clear identity and full figure reference, neutral background, no extra people, feet visible when possible, natural skin texture, normal face, normal clothing or neutral fitted outfit',
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
