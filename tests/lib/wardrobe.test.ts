import { partDocument, outfitSource } from '@/lib/looks/parts';
import { describe,it,expect } from 'vitest';
import { composeCharacterLook } from '@/lib/outfits/compose';
import { buildLookPreviewPrompt } from '@/lib/outfits/previewPrompt';
import { imageModelPolicy,generationErrorMessage } from '@/lib/generation/imageModelPolicy';
import { filterLorasForModel } from '@/lib/lora/modelFilters';
import type { CharacterSummary } from '@/lib/characters/types';
const c:CharacterSummary={id:'c',name:'Inventor',gender:'male',traits:{hair_color:'brown',outerwear:'old red coat',left_arm_prosthesis:'Permanent LEFT prosthesis with EMPTY socket',unknown_identity_detail:'scar'},editorState:{},currentVersionId:'v1',previewStatusSummary:null,createdAt:'',updatedAt:'',deletedAt:null};
const outfit:any={id:'o',name:'Original',description:'charcoal jacket',constraints:'detachable tool in RIGHT hand',coversFace:false,revision:1,deletedAt:null};
describe('wardrobe composition',()=>{
 it('replaces old clothing, preserves permanent anatomy and unknown traits',()=>{const l=composeCharacterLook(c,{mode:'outfit'},outfit);expect(l.identity).toContain('EMPTY socket');expect(l.identity).toContain('scar');expect(l.identity).not.toContain('coat');expect(l.outfit).toContain('charcoal jacket');expect(l.outfit).not.toContain('old red coat');});
 it('custom and neutral modes never inherit the default costume or equipment',()=>{for(const mode of ['custom','neutral'] as const){const l=composeCharacterLook(c,{mode,customText:'blue suit'},null);expect(l.outfit).not.toContain('coat');expect(l.outfit).not.toContain('tool');expect(l.identity).toContain('LEFT');}});
 it('preserves a legacy default when no library outfit exists',()=>expect(composeCharacterLook(c,{mode:'default'},null).outfit).toContain('old red coat'));
 it('does not demand visible eyes behind a helmet',()=>{const l=composeCharacterLook({...c,traits:{hair_color:'black'}},{mode:'outfit'},{...outfit,coversFace:true,promptParts:partDocument(outfitSource(outfit.description,outfit.constraints,true),[{region:'headwear',text:'Black closed helmet'}])});const prompt=buildLookPreviewPrompt(l,'portrait');expect(prompt).toContain('Keep the assigned helmet');expect(prompt).not.toContain('face fully visible');expect(prompt).not.toContain('Natural readable facial');});
 it('rejects newly selecting an archived default',()=>expect(()=>composeCharacterLook(c,{}, {...outfit,deletedAt:'today'})).toThrow('archived'));
 it('captures independent outfit text and revision',()=>{const l=composeCharacterLook(c,{},outfit);outfit.description='changed';expect(l.outfit).toContain('charcoal');outfit.description='charcoal jacket';});
});
describe('image model policy',()=>{
 it('uses 9 steps for Z-Image and 8 for Krea2, never ControlNet for Krea2',()=>{expect(imageModelPolicy('z-image').steps).toBe(9);expect(imageModelPolicy('krea2-turbo')).toMatchObject({steps:8,cfg:1,useControlnet:false});});
 it('rejects unsupported models and reports paused endpoints',()=>{expect(()=>imageModelPolicy('unknown')).toThrow();expect(generationErrorMessage('ENDPOINT_PAUSED max_workers=0')).toContain('paused');});
 it('separates LoRAs by base model',()=>{const l:any[]=[{s3Path:'z',baseModel:'z-image',targetOverride:'image'},{s3Path:'k',baseModel:'krea2-turbo',targetOverride:'image'}];expect(filterLorasForModel(l,'krea2-turbo').map(x=>x.s3Path)).toEqual(['k']);});
});
