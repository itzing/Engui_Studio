import { readPartDocument, identitySource, outfitSource, inferIdentityParts, type PromptPart } from '@/lib/looks/parts';
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
  const identityDoc = readPartDocument(character.editorState?.promptParts, identitySource(character.traits, character.gender));
  const identityParts = identityDoc?.parts || inferIdentityParts(Object.fromEntries(Object.entries(character.traits).filter(([key])=>!COSTUME_KEYS.includes(key))),character.gender);
  const issues:string[] = [];
  if (character.editorState?.promptParts && !identityDoc) issues.push('Character details changed; review the identity parts.');
  if (identityParts.some(p=>p.region==='unclassified')) issues.push('Classify the remaining identity parts.');
  let outfitParts:PromptPart[]|undefined;
  if(mode==='neutral') outfitParts=character.gender==='male'
    ? [{region:'hips',text:'Plain neutral athletic swim shorts'}]
    : [{region:'shoulders',text:'Plain neutral swimsuit shoulder straps'},{region:'torso',text:'Modest plain neutral closed one-piece swimsuit'},{region:'hips',text:'Plain closed swimsuit lower section'}];
  else {
    const document=mode==='custom'
      ? readPartDocument(selection.customParts,outfitSource(selection.customText||''))
      : outfit ? readPartDocument(outfit.promptParts,outfitSource(outfit.description,outfit.constraints,outfit.coversFace)) : null;
    if(document) outfitParts=document.parts;
    if(costume && !document) issues.push('Classify the outfit into visible parts (collar, torso, lower panels, footwear).');
    if(outfitParts?.some(p=>p.region==='unclassified')) issues.push('Classify the remaining outfit parts.');
  }
  return { characterId: character.id, characterName: character.name, characterVersionId: character.currentVersionId,
    identity: buildCharacterPromptFromSummary(character, { excludeTraitKeys: COSTUME_KEYS }), outfit: costume,
    outfitId: outfit?.id || null, outfitRevision: outfit?.revision || null,
    name: mode === 'neutral' ? 'Neutral anatomy' : mode === 'custom' ? 'Custom outfit' : outfit?.name || 'Character default',
    composition:{version:1,identity:identityParts,outfit:outfitParts,issues},
    mode, coversFace: (mode === 'default' || mode === 'outfit') && Boolean(outfit ? outfit.coversFace : character.traits.helmet), resolvedAt: new Date().toISOString() };
}
