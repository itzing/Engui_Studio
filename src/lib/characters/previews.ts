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
  portrait: 'professional studio portrait photograph, head and shoulders framing, direct readable facial features, softbox lighting, realistic camera photo, single person',
  upper_body: 'professional studio portrait photograph, upper body framing, visible face, torso and arms, clear posture, softbox lighting, realistic camera photo, single person',
  full_body: 'professional full-body studio photograph, standing natural pose, face visible, complete human figure visible, softbox lighting, realistic camera photo, single person',
};

const SLOT_PROMPT_SUFFIX: Record<CharacterPreviewSlot, string> = {
  portrait: 'high clarity identity photo, neutral seamless studio background, natural skin texture, face fully visible, no extra people',
  upper_body: 'high clarity identity photo, neutral seamless studio background, natural skin texture, hands visible when possible, no extra people',
  full_body: 'high clarity full figure photo, neutral seamless studio background, feet visible when possible, natural skin texture, normal face, no extra people',
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

function getPreviewWardrobe(character: CharacterSummary, slot: CharacterPreviewSlot): string {
  if (slot === 'portrait') return '';
  const gender = (character.gender || '').toLowerCase();
  const ageValue = character.traits.age || '';
  const age = Number(String(ageValue).match(/\d+/)?.[0] || NaN);
  const isUnderage = Number.isFinite(age) && age < 18;

  if (gender === 'male') return isUnderage ? 'plain athletic swim shorts' : 'plain swim briefs';
  if (gender === 'female') return 'modest closed one-piece swimsuit';
  return 'simple neutral fitted swimwear';
}

export function buildCharacterPreviewPrompt(character: CharacterSummary, slot: CharacterPreviewSlot): string {
  const ageValue = character.traits.age || '';
  const formattedAge = formatCharacterAge(ageValue);
  const formattedGender = resolveRenderedGender(character.gender || '', ageValue);
  const wardrobe = getPreviewWardrobe(character, slot);
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
    wardrobe,
    SLOT_PROMPT_SUFFIX[slot],
  ]
    .filter(Boolean)
    .join(', ');
}
