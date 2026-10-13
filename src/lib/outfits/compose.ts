import type { CharacterSummary } from '@/lib/characters/types';
import { buildCharacterPromptFromSummary } from '@/lib/scenes/utils';
import { COSTUME_KEYS, type CharacterLook, type OutfitSelection, type OutfitSummary } from './types';

export function composeCharacterLook(character: CharacterSummary, selection: OutfitSelection, outfit: OutfitSummary | null): CharacterLook {
  const mode = selection.mode || 'default';
  if ((mode === 'default' || mode === 'outfit') && outfit?.deletedAt) throw new Error('This outfit is archived. Choose another outfit.');
  const legacyCostume = Object.entries(character.traits).filter(([key]) => COSTUME_KEYS.includes(key)).map(([key,value]) => `${key}: ${value}`).join(', ');
  const costume = mode === 'neutral'
    ? character.gender === 'male' ? 'Plain neutral athletic swim shorts, no jewelry or detachable equipment.' : 'Modest plain neutral closed one-piece swimsuit, no jewelry or detachable equipment.'
    : mode === 'custom' ? selection.customText?.trim() || ''
    : outfit ? [outfit.description, outfit.constraints].filter(Boolean).join('. ') : legacyCostume;
  return { characterId: character.id, characterName: character.name, characterVersionId: character.currentVersionId,
    identity: buildCharacterPromptFromSummary(character, { excludeTraitKeys: COSTUME_KEYS }), outfit: costume,
    outfitId: outfit?.id || null, outfitRevision: outfit?.revision || null,
    name: mode === 'neutral' ? 'Neutral anatomy' : mode === 'custom' ? 'Custom outfit' : outfit?.name || 'Character default',
    mode, coversFace: (mode === 'default' || mode === 'outfit') && Boolean(outfit ? outfit.coversFace : character.traits.helmet), resolvedAt: new Date().toISOString() };
}
