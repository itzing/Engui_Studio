import type { CharacterLook } from './types';
import type { CharacterPreviewSlot } from '@/lib/characters/types';
export function buildLookPreviewPrompt(look: CharacterLook, slot: CharacterPreviewSlot) {
 const framing=slot==='portrait'?'head and shoulders portrait':slot==='upper_body'?'upper body, torso and arms':'complete full body, feet in frame';
 return ['Professional realistic studio photograph, single person, '+framing,'IDENTITY: '+look.identity,'OUTFIT: '+look.outfit,
 look.coversFace?'Keep the outfit helmet and face covering in place; only exposed facial areas are visible.':'Natural readable facial features.',
 'Neutral seamless studio background, softbox lighting, natural materials.'].join('. ');
}
