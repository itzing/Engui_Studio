/** Deterministic, provider-independent visible-detail metadata. No generated text. */
export const REGIONS = ['identity','face','hair','headwear','neck','shoulders','torso','waist','arms','hands','hips','legs','lower_legs','feet','unclassified'] as const;
export type Region = typeof REGIONS[number];
export type Framing = 'closeup'|'portrait'|'half_body'|'three_quarter'|'full_body';
export type PromptPart = { region: Region; text: string; exposed?: boolean };
export type PartDocument = { version: 1; sourceKey: string; parts: PromptPart[] };
export const FRAMINGS: Framing[] = ['closeup','portrait','half_body','three_quarter','full_body'];
export function normalizeFraming(value: unknown): Framing {
  if (value === 'upper_body') return 'half_body';
  return FRAMINGS.includes(value as Framing) ? value as Framing : 'full_body';
}
export function sourceKey(value: unknown): string {
  const canonical = (v: any): any => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])) : v;
  const text=JSON.stringify(canonical(value));
  let hash=2166136261;
  for (let i=0;i<text.length;i++) hash=Math.imul(hash ^ text.charCodeAt(i),16777619);
  return (hash>>>0).toString(16);
}
export function validateParts(value: unknown): PromptPart[] {
  if (!Array.isArray(value) || value.length>100) throw new Error('Use at most 100 visible-detail parts.');
  return value.map((part: any) => {
    if (!part || !REGIONS.includes(part.region) || typeof part.text !== 'string' || !part.text.trim() || part.text.length>3000) throw new Error('Each part needs a valid body region and 1–3000 characters of text.');
    return {region:part.region,text:part.text.trim(),...(part.exposed===true?{exposed:true}:{})};
  });
}
export function partDocument(source: unknown, parts: PromptPart[]): PartDocument {
  return {version:1,sourceKey:sourceKey(source),parts:validateParts(parts)};
}
export function readPartDocument(value: unknown, source?: unknown): PartDocument|null {
  try {
    const v=typeof value==='string'?JSON.parse(value):value as any;
    if (!v || v.version!==1 || typeof v.sourceKey!=='string' || (source!==undefined && v.sourceKey!==sourceKey(source))) return null;
    return {...v,parts:validateParts(v.parts)};
  } catch { return null; }
}
export function outfitSource(description: string, constraints='', coversFace=false) {return {description:description.trim(),constraints:constraints.trim(),coversFace};}
export function identitySource(traits: Record<string,string>, gender: string|null) { return {traits,gender}; }
export function visibleExtras(value: unknown): Region[] {
  if (!Array.isArray(value) || value.some(r=>!['arms','hands'].includes(r))) throw new Error('Extra visible regions may contain arms and hands only. Change framing to include the lower body.');
  return [...new Set(value)] as Region[];
}
const BASE: Record<Framing,Region[]> = {
 closeup:['identity','face','hair','headwear','neck'],
 portrait:['identity','face','hair','headwear','neck','shoulders'],
 half_body:['identity','face','hair','headwear','neck','shoulders','torso','waist','arms'],
 three_quarter:['identity','face','hair','headwear','neck','shoulders','torso','waist','arms','hands','hips','legs'],
 full_body:REGIONS.filter(r=>r!=='unclassified'),
};
export function visibleRegions(framing: Framing, extra: Region[]=[]): Set<Region> {
  const additions=visibleExtras(extra);
  return new Set([...BASE[framing],...additions,...(additions.includes('hands')?['arms' as Region]:[])]);
}
export const FRAMING_TEXT: Record<Framing,string> = {
 closeup:'Close-up of the face and head. The complete head, hair and any headwear fit inside the image with a small margin above; lower edge at the base of the neck. The face or helmet dominates the frame.',
 portrait:'Head-and-shoulders portrait, cropped below the shoulders. The entire head, hair and any headwear are inside the image with clear headroom. The head occupies the main area of the frame.',
 half_body:'Waist-up medium portrait. Show the entire head, hair and any headwear with clear headroom, shoulders, torso and visible arms. The lower edge cuts at the waist.',
 three_quarter:'Three-quarter-length view, framed from above the head to the knees. Keep the entire head and any headwear inside the image with headroom.',
 full_body:'Complete head-to-toe view. The entire head, hair, any headwear and both feet fit inside the image with space above the head and below the feet.',
};
export function inferIdentityParts(traits: Record<string,string>, gender: string|null): PromptPart[] {
 const parts: PromptPart[] = gender?[{region:'identity',text:gender==='male'?'Adult man':gender==='female'?'Adult woman':gender}]:[];
 for(const [key,text] of Object.entries(traits)) {
  let region:Region='unclassified';
  if (/^(age|skin_tone|undertone|skin_texture|overall_character)$/.test(key)) region='identity';
  else if (/^(hair_|hairstyle)/.test(key)) region='hair';
  else if (/^(face|eye|eyebrow|nose|lip|mouth|chin|cheek|jaw|brow|expression|facial)/.test(key)) region='face';
  else if (/^neck/.test(key)) region='neck';
  else if (/^shoulder/.test(key)) region='shoulders';
  else if (/^(body_build|chest|breast|bust|torso)/.test(key)) region='torso';
  else if (/^(waist|.*abdomen)/.test(key)) region='waist';
  else if (/^(hip|pelvis|buttock)/.test(key)) region='hips';
  else if (/^(body_proportions|height|leg|thigh|calf)/.test(key)) region='legs';
  else if (/^(left_arm|right_arm|arm|prosthesis)/.test(key)) region='arms';
  else if (/^(fingernail|hand|finger)/.test(key)) region='hands';
  else if (/^(foot|feet|toe)/.test(key)) region='feet';
  parts.push({region,text:key.replace(/_/g,' ')+': '+text});
 }
 return parts;
}
