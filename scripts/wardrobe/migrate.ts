import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { buildCharacterPromptFromSummary } from '../../src/lib/scenes/utils';
import { toCharacterSummary } from '../../src/lib/characters/utils';
export const SHOWDOWN = 'af66834c-0ed0-42ea-9c90-d96c1e7643e8';
export const MAPPING: Record<string,string[]> = {
 '82ab7f99-37ab-41ca-b5a7-4cb57dc62be8':['earrings','neck_jewelry','outerwear','top','lower_garment','hand_jewelry','footwear','signature_detail'],
 '0dfaf208-8e0f-49a4-a331-2549539ebf7a':['face_visibility','helmet','body_armor','sleeves','gloves','belt_and_hip_guards','trousers','footwear','armor_accents','baton','riot_shield'],
 '3892a623-6bf9-4f44-8b7e-60f5851c3a72':['earring','top','dress','asymmetric_sleeves','wrist_jewelry','chest_detail','belt','skirt','hosiery','footwear'],
 '691fa2d5-3288-442e-b4b4-4fc26b3f63ea':['headwear','earrings','neck_jewelry','outerwear','top','trousers','belt','footwear'],
 '10aa584a-8916-4e3d-ba20-424dc213a9f3':['goggles','shirt','outerwear','chest_harness','trousers','glove','footwear'],
 '0322ac41-7119-4a21-b0d0-ec99a916a045':['outerwear','top','trousers','footwear','right_hand_tool','tool_separation'],
};
export async function migrate(db: PrismaClient) {
 return db.$transaction(async tx=>{
  const columns:any[] = await tx.$queryRawUnsafe('PRAGMA table_info("characters")');
  if(!columns.some(c=>c.name==='defaultOutfitId')) {
   const sql=readFileSync(resolve('scripts/wardrobe/001-wardrobe.sql'),'utf8');
   for(const statement of sql.split(';').map(x=>x.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
   await tx.$executeRawUnsafe("UPDATE studio_photo_sessions SET outfitMode='custom' WHERE trim(outfitText) <> ''");
   // A previous settings record means initialization has already happened, even if the user deleted every category.
   await tx.$executeRawUnsafe('UPDATE studio_pose_library_settings SET seededAt=updatedAt');
  }
  let migrated=0;
  for(const [id,keys] of Object.entries(MAPPING)) {
   const c=await tx.character.findFirst({where:{id,workspaceId:SHOWDOWN}});
   if(!c)continue;
   if(await tx.outfit.findFirst({where:{ownerCharacterId:id,sourceJson:{contains:'showdown-original-v1'}}}))continue;
   const oldTraits=JSON.parse(c.traits); const traits={...oldTraits};const costume:Record<string,string>={};
   for(const key of keys)if(typeof traits[key]==='string'){costume[key]=traits[key];delete traits[key];}
   if(!Object.keys(costume).length)throw new Error('Missing original outfit traits for '+c.name);
   const oldPrompt=buildCharacterPromptFromSummary(toCharacterSummary(c),{includeName:false,includeGender:false});
   const runs=await tx.studioSessionRun.findMany({where:{workspaceId:SHOWDOWN}});
   for(const run of runs){const snap=JSON.parse(run.templateSnapshotJson||'{}');if(snap.characterId===id&&!snap.characterPrompt){await tx.studioSessionRun.update({where:{id:run.id},data:{templateSnapshotJson:JSON.stringify({...snap,characterPrompt:oldPrompt,wardrobeMigrationPinned:true})}});}}
   if(id==='82ab7f99-37ab-41ca-b5a7-4cb57dc62be8') {traits.hair_color='Pale warm golden champagne blonde; softly yellow-gold, not silver, gray or white'; traits.hairstyle='Silky perfectly straight long hair, flat off-center part, falling beside the face to the upper chest; no swept-back silver crest';}
   if(id==='0322ac41-7119-4a21-b0d0-ec99a916a045') traits.prosthesis_terminal=oldTraits.prosthesis_terminal || 'Permanent LEFT forearm prosthesis ends in an EMPTY exposed circular docking socket. No attached hand, fingers or claw.';
   const outfit=await tx.outfit.create({data:{workspaceId:SHOWDOWN,ownerCharacterId:id,name:c.name+' — Original',description:Object.entries(costume).map(([k,v])=>k.replaceAll('_',' ')+': '+v).join('\n'),coversFace:id==='0dfaf208-8e0f-49a4-a331-2549539ebf7a',sourceJson:JSON.stringify({migration:'showdown-original-v1',originalTraits:oldTraits,originalEditorState:c.editorState,movedTraits:costume,originalCurrentVersionId:c.currentVersionId})}});
   await tx.characterOutfit.create({data:{workspaceId:SHOWDOWN,characterId:id,outfitId:outfit.id}});
   const last=await tx.characterVersion.aggregate({where:{characterId:id},_max:{versionNumber:true}});
   const version=await tx.characterVersion.create({data:{id:randomUUID(),characterId:id,traitsSnapshot:JSON.stringify(traits),editorStateSnapshot:c.editorState,versionNumber:(last._max.versionNumber||0)+1,changeSummary:'Separate Original outfit from permanent identity; original source retained in wardrobe migration evidence.'}});
   await tx.character.update({where:{id},data:{traits:JSON.stringify(traits),defaultOutfitId:outfit.id,currentVersionId:version.id}});
   migrated++;
  }
  const fk:any[]=await tx.$queryRawUnsafe('PRAGMA foreign_key_check');if(fk.length)throw new Error('Foreign key violations: '+JSON.stringify(fk));
  return {migrated};
 },{timeout:60000});
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
 const dbPath=process.argv[2];if(!dbPath)throw new Error('Usage: tsx scripts/wardrobe/migrate.ts /absolute/database.db');
 const db=new PrismaClient({datasources:{db:{url:'file:'+resolve(dbPath)}}});
 migrate(db).then(r=>console.log(JSON.stringify(r))).finally(()=>db.$disconnect());
}
