import type { CharacterLook } from './types';
import type { CharacterPreviewSlot } from '@/lib/characters/types';
import { compileVisibleLook } from '@/lib/looks/compiler';
import { normalizeFraming } from '@/lib/looks/parts';
export function buildLookPreviewPrompt(look: CharacterLook, slot: CharacterPreviewSlot) {
 const visible=compileVisibleLook(look,normalizeFraming(slot));
 return [visible.framingPrompt, 'Single person. Identity: '+visible.identity,
 visible.outfit?'Visible outfit: '+visible.outfit:'',
 'Professional realistic studio photograph. Neutral seamless studio background, softbox lighting, natural materials.'].filter(Boolean).join('\n');
}
