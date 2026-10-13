import {describe,it,expect} from 'vitest';
import {partDocument,identitySource,outfitSource,visibleRegions,inferIdentityParts,readPartDocument,visibleExtras} from '@/lib/looks/parts';
import {compileVisibleLook} from '@/lib/looks/compiler';
import {composeCharacterLook} from '@/lib/outfits/compose';
import {buildLookPreviewPrompt} from '@/lib/outfits/previewPrompt';
import {assembleStudioSessionPrompt} from '@/lib/studio-sessions/utils';
import sources from '../../scripts/framing/showdown-source-checks.json';
import costumes from '../../scripts/framing/showdown-outfit-parts.json';
const character:any={id:'c',name:'Test',gender:'male',traits:{hair_color:'Black',jawline:'Square jaw',left_arm_prosthesis:'LEFT empty socket',fingernails:'Short nails'},editorState:{},currentVersionId:'v1'};
const source={description:'Standing collar, gold wrist cuff, ankle-length coat and black boots',constraints:'',coversFace:false};
const costume:any={...source,id:'o',name:'Uniform',revision:1,deletedAt:null,promptParts:partDocument(outfitSource(source.description),[
 {region:'neck',text:'Standing blue collar'},
 {region:'hands',text:'Gold wrist cuff'},
 {region:'torso',text:'Blue coat bodice'},
 {region:'lower_legs',text:'Ankle-length coat panels'},
 {region:'feet',text:'Black boots'}
])};
const look=()=>composeCharacterLook(character,{},costume);
describe('framing-aware look composition',()=>{
 it('keeps portrait face/hair/collar but excludes lower body, hand props and prostheses outside crop',()=>{
  const p=buildLookPreviewPrompt(look(),'portrait');expect(p).toContain('Square jaw');expect(p).toContain('Standing blue collar');expect(p).toContain('headroom');
  for(const word of ['Black boots','Ankle-length','Gold wrist','LEFT empty'])expect(p).not.toContain(word);
 });
 it('selects torso/arms for waist-up without ankle hem or boots',()=>{const p=buildLookPreviewPrompt(look(),'upper_body');expect(p).toContain('Blue coat bodice');expect(p).toContain('LEFT empty socket');expect(p).not.toContain('Black boots');expect(p).not.toContain('Ankle-length');});
 it('retains head and feet for full-body',()=>{const p=buildLookPreviewPrompt(look(),'full_body');expect(p).toContain('Black boots');expect(p).toContain('Ankle-length');expect(p).toContain('space above the head');});
 it('does not include lower legs and feet for a knee crop',()=>{expect(visibleRegions('three_quarter').has('feet')).toBe(false);expect(visibleRegions('three_quarter').has('lower_legs')).toBe(false);});
 it('adds hands and permanent limb constraints to a portrait pose without widening it',()=>{const p=compileVisibleLook(look(),'portrait',['hands']);expect(p.outfit).toContain('Gold wrist');expect(p.identity).toContain('LEFT empty');expect(p.framingPrompt).toContain('do not widen');expect(p.outfit).not.toContain('boots');});
 it('rejects using pose metadata to add the lower body to a portrait',()=>expect(()=>visibleExtras(['feet'])).toThrow('Change framing'));
 it('suppresses hidden face/hair and retains explicitly exposed jaw under a helmet',()=>{
  const c={...character,editorState:{promptParts:partDocument(identitySource(character.traits,character.gender),[{region:'face',text:'EXPOSED LOWER JAW',exposed:true},{region:'face',text:'HIDDEN BLUE EYES'},{region:'hair',text:'HIDDEN CURLS'}])}};
  const o={...costume,coversFace:true,promptParts:partDocument(outfitSource(source.description,'',true),[{region:'headwear',text:'CLOSED BLACK HELMET'}])};
  const p=buildLookPreviewPrompt(composeCharacterLook(c,{},o),'portrait');expect(p).toContain('EXPOSED LOWER JAW');expect(p).toContain('CLOSED BLACK HELMET');expect(p).not.toContain('HIDDEN');
 });
 it('invalidates outfit classification when original text changes',()=>expect(()=>buildLookPreviewPrompt(composeCharacterLook(character,{}, {...costume,description:'New yellow boots'}),'portrait')).toThrow('Classify the outfit'));
 it('invalidates identity classification after trait edits',()=>{
  const c={...character,editorState:{promptParts:partDocument(identitySource(character.traits,character.gender),inferIdentityParts(character.traits,character.gender))},traits:{...character.traits,hair_color:'Red'}};
  expect(()=>buildLookPreviewPrompt(composeCharacterLook(c,{},costume),'portrait')).toThrow('Character details changed');
 });
 it('does not silently discard unknown identity features in a crop',()=>expect(()=>buildLookPreviewPrompt(composeCharacterLook({...character,traits:{mystery:'crucial detail'}},{},costume),'portrait')).toThrow('Classify'));
 it('supports unstructured full-body without changing the source',()=>{const p=buildLookPreviewPrompt(composeCharacterLook(character,{}, {...costume,promptParts:null}),'full_body');expect(p).toContain(source.description);});
 it('custom outfit replaces default and honors its own regional parts',()=>{
  const l=composeCharacterLook(character,{mode:'custom',customText:'red shirt and green shoes',customParts:partDocument(outfitSource('red shirt and green shoes'),[{region:'shoulders',text:'RED SHIRT COLLAR'},{region:'feet',text:'GREEN SHOES'}])},null);
  expect(buildLookPreviewPrompt(l,'portrait')).toContain('RED SHIRT COLLAR');expect(buildLookPreviewPrompt(l,'portrait')).not.toContain('GREEN SHOES');expect(l.outfit).not.toContain('Standing collar');
 });
 it('neutral anatomy does not demand swim shorts in a portrait',()=>{const p=buildLookPreviewPrompt(composeCharacterLook(character,{mode:'neutral'},null),'portrait');expect(p).not.toContain('swim shorts');expect(p).not.toContain('boots');});
 it('uses the same filtered fragments in Studio and preview, framing and pose first',()=>{
  const p=assembleStudioSessionPrompt({look:look(),characterPrompt:'IGNORE FULL LEGACY IDENTITY',characterAge:'',environmentText:'Casino',outfitText:'IGNORE FULL LEGACY COSTUME',hairstyleText:'',positivePrompt:'Photorealistic',negativePrompt:'',pose:{prompt:'Head turned left',framing:'portrait'}});
  expect(p.positivePrompt.startsWith('Head-and-shoulders')).toBe(true);expect(p.positivePrompt.indexOf('Pose:')).toBeLessThan(p.positivePrompt.indexOf('Identity:'));expect(p.positivePrompt).not.toContain('IGNORE');expect(p.pieces.outfit).toBe('Standing blue collar');expect(p.composition?.composerVersion).toBe(1);
 });
 it('preserves a historical unstructured Studio snapshot exactly',()=>{
  const input={characterPrompt:'Old full identity',characterAge:'',environmentText:'Old scene',outfitText:'Old full boots and coat',hairstyleText:'',positivePrompt:'Old style',negativePrompt:'Old negative',pose:{prompt:'Old pose'}};
  const p=assembleStudioSessionPrompt(input);expect(p.positivePrompt).toContain('Old full boots and coat');expect(p.composition).toBeUndefined();expect(p.negativePrompt).toBe('Old negative');
 });
 it('fingerprints are independent of object key order and reject malformed documents',()=>{expect(readPartDocument(partDocument({a:1,b:2},[]),{b:2,a:1})).not.toBeNull();expect(readPartDocument({version:1,sourceKey:'x',parts:[{region:'not-real',text:'x'}]})).toBeNull();});
 for(const c of sources)it(c.name+' default portrait excludes footwear and long hem',()=>{
  const outfit:any={id:'o',name:c.name,description:c.description,constraints:c.constraints,coversFace:c.name==='Protector',revision:1,promptParts:partDocument(outfitSource(c.description,c.constraints,c.name==='Protector'),(costumes as any)[c.name])};
  const parts=inferIdentityParts(c.traits as any,c.gender);
  const l=composeCharacterLook({...character,...c,editorState:{promptParts:partDocument(identitySource(c.traits as any,c.gender),parts)}} as any,{},outfit);
  const p=compileVisibleLook(l,'portrait');expect(p.omitted.some(x=>x.region==='feet')).toBe(true);expect(p.outfit).not.toMatch(/boots|loafers|stockings|ankles|floor-length|trouser/);
 });
});
