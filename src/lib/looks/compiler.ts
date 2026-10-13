import type { CharacterLook } from '@/lib/outfits/types';
import { FRAMING_TEXT, visibleRegions, type Framing, type PromptPart, type Region } from './parts';
export class LookCompositionError extends Error { readonly status=422; }
export type VisibleLook = { identity: string; outfit: string; framing: Framing; framingPrompt: string; included: PromptPart[]; omitted: PromptPart[]; warnings: string[]; composerVersion: 1 };
export function compileVisibleLook(look: CharacterLook, framing: Framing, extra: Region[]=[]): VisibleLook {
 const visible=visibleRegions(framing,extra);
 const metadata=look.composition;
 const crop=framing!=='full_body';
 if (!metadata && crop) throw new LookCompositionError('This look has no visible-detail classification. Edit its character and outfit details, then create a new run.');
 if (crop && metadata?.issues.length) throw new LookCompositionError('Review visible details before generating a cropped view: '+metadata.issues.join(' '));
 const included:PromptPart[]=[],omitted:PromptPart[]=[];
 const select=(parts:PromptPart[]|undefined,fallback:string)=>{
   if (!parts) return fallback;
   return parts.filter(p=>{
     const occluded=look.coversFace && (p.region==='hair'||(p.region==='face'&&!p.exposed));
     const keep=(visible.has(p.region)||(!crop&&p.region==='unclassified'))&&!occluded;
     (keep?included:omitted).push(p);return keep;
   }).map(p=>p.text.replace(/\.+$/,'')).join('. ');
 };
 const identity=select(metadata?.identity,look.identity);
 // A legacy full-body outfit stays intact; an unclassified crop is rejected above.
 const outfit=select(metadata?.outfit,look.outfit);
 const face=look.coversFace?'Keep the assigned helmet or mask closed; only explicitly exposed facial areas are visible.':'Keep the head and facial features clearly readable.';
 return {identity,outfit,framing,framingPrompt:FRAMING_TEXT[framing]+' '+face+(extra.length?' Raised limbs specified by the pose enter this crop; do not widen the framing.':''),included,omitted,warnings:metadata?.issues||[],composerVersion:1};
}
