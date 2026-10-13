import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { partDocument, identitySource, outfitSource, inferIdentityParts, type PromptPart } from '../../src/lib/looks/parts';
import { composeCharacterLook } from '../../src/lib/outfits/compose';
import { toCharacterSummary } from '../../src/lib/characters/utils';
export const SHOWDOWN='af66834c-0ed0-42ea-9c90-d96c1e7643e8';
const MARKER='framing-aware-showdown-v1';
const OUTFITS=JSON.parse(readFileSync(resolve('scripts/framing/showdown-outfit-parts.json'),'utf8'));
const EXPECTED=JSON.parse(readFileSync(resolve('scripts/framing/showdown-source-checks.json'),'utf8'));
export async function migrate(db:PrismaClient) {
 return db.$transaction(async tx=>{
  for(const [table,column,defaultValue] of [['studio_poses','visibleRegionsJson','[]'],['studio_photo_sessions','outfitPartsJson','null']]){
   const columns:any[]=await tx.$queryRawUnsafe('PRAGMA table_info("'+table+'")');
   if(!columns.some(c=>c.name===column)) await tx.$executeRawUnsafe('ALTER TABLE "'+table+'" ADD COLUMN "'+column+'" TEXT NOT NULL DEFAULT '+JSON.stringify(defaultValue));
  }
  let characters=0,outfits=0,drafts=0,poses=0;
  const looks=new Map<string,any>();
  for(const expected of EXPECTED){
   const c=await tx.character.findFirst({where:{id:expected.id,workspaceId:SHOWDOWN,deletedAt:null}});
   if(!c)throw new Error('Expected Showdown character missing: '+expected.name);
   const o=await tx.outfit.findFirst({where:{id:c.defaultOutfitId||'',workspaceId:SHOWDOWN,ownerCharacterId:c.id,deletedAt:null}});
   if(!o)throw new Error('Expected personal default outfit missing: '+c.name);
   const source=JSON.parse(o.sourceJson||'{}'), editor=JSON.parse(c.editorState||'{}'),traits=JSON.parse(c.traits);
   if(source.framingMigration===MARKER) continue;
   if(JSON.stringify(traits)!==JSON.stringify(expected.traits)||c.gender!==expected.gender||o.description!==expected.description||o.constraints!==expected.constraints) throw new Error('Source changed since review: '+c.name);
   let parts=inferIdentityParts(traits,c.gender);
   if(c.name==='Inventor'){
    parts=parts.filter(p=>!/^body proportions:|^left arm prosthesis:|^prosthesis terminal:/.test(p.text));
    parts.push({region:'arms',text:'LEFT arm is amputated above the elbow. Permanent red-and-black mechanical forearm attaches to the upper-arm stump: angular crimson plates, silver brackets, exposed mechanisms, two cyan-tipped cylinders. It ends in an EMPTY circular docking socket with silver rim and dark connectors, with NO hand, fingers or claw. RIGHT hand is intact.'});
   }
   if(c.name==='Protector') parts=parts.map(p=>p.region==='face'?{...p,exposed:true}:p);
   // Length below the crop is not a demand to include hair ends in a portrait.
   if(c.name==='Gambler') parts=parts.filter(p=>!/^hair length base:|^hairstyle:/.test(p.text)).concat([{region:'hair',text:'Silky straight warm champagne-blonde hair with a flat off-center part, smooth strands beside the face.'},{region:'torso',text:'Long straight champagne-blonde hair ends at the upper chest.'}]);
   if(c.name==='Cheater') parts=parts.filter(p=>!/^hair length base:/.test(p.text)).concat([{region:'hair',text:'Long straight black hair with deep-red streaks on one side; visible strands frame the face.'}]);
   if(parts.some(p=>p.region==='unclassified'))throw new Error('Unclassified identity: '+c.name);
   const nextEditor={...editor,promptParts:partDocument(identitySource(traits,c.gender),parts)};
   const doc=partDocument(outfitSource(o.description,o.constraints,o.coversFace),OUTFITS[expected.name] as PromptPart[]);
   const updatedOutfit=await tx.outfit.update({where:{id:o.id},data:{sourceJson:JSON.stringify({...source,framingMigration:MARKER,promptParts:doc}),revision:{increment:1}}});outfits++;
   const last=await tx.characterVersion.aggregate({where:{characterId:c.id},_max:{versionNumber:true}});
   const v=await tx.characterVersion.create({data:{characterId:c.id,traitsSnapshot:c.traits,editorStateSnapshot:JSON.stringify(nextEditor),versionNumber:(last._max.versionNumber||0)+1,changeSummary:'Classify identity by visible region; source traits unchanged.'}});
   const updated=await tx.character.update({where:{id:c.id},data:{editorState:JSON.stringify(nextEditor),currentVersionId:v.id}});characters++;
   const look=composeCharacterLook(toCharacterSummary(updated),{mode:'default'},{...updatedOutfit,promptParts:doc,deletedAt:null});
   looks.set(c.id,{look,oldVersion:c.currentVersionId,oldRevision:o.revision});
  }
  const portraitPoses=await tx.studioPose.findMany({where:{workspaceId:SHOWDOWN,category:{name:'Portrait'}}});
  for(const pose of portraitPoses){
   // Curated Portrait poses involving the chin, temple and crossed forearms bring limbs into the crop.
   const extra=['c8cb16cf-d3df-4673-a53f-fda4ca747989','1627c60b-3a8d-4e55-bf53-bd4fd4497aaf','8b2048dd-413b-4306-aedf-f13ce8db30ce','1c691157-2705-460d-8aec-c6016441893e'].includes(pose.id)?['arms','hands']:[];
   const json=JSON.stringify(extra);
   if(pose.visibleRegionsJson!==json){await tx.studioPose.update({where:{id:pose.id},data:{visibleRegionsJson:json}});poses++;}
  }
  // Only pristine drafts: no revisions, no outputs and an exact pinned source match.
  const runs=await tx.studioSessionRun.findMany({where:{workspaceId:SHOWDOWN,status:'draft'},include:{shots:{include:{revisions:true,versions:true}}}});
  for(const run of runs){
   if(run.shots.some(s=>s.revisions.length||s.versions.length))continue;
   const snap=JSON.parse(run.templateSnapshotJson||'{}'), old=snap.characterLookSnapshot, pair=looks.get(snap.characterId||old?.characterId);
   if(!pair||!old||old.mode!=='default'||old.characterVersionId!==pair.oldVersion||old.outfitRevision!==pair.oldRevision||old.outfitId!==pair.look.outfitId)continue;
   await tx.studioSessionRun.update({where:{id:run.id},data:{templateSnapshotJson:JSON.stringify({...snap,characterLookSnapshot:pair.look,characterPrompt:pair.look.identity,outfitText:pair.look.outfit,framingMigration:MARKER})}});drafts++;
  }
  const fk:any[]=await tx.$queryRawUnsafe('PRAGMA foreign_key_check');if(fk.length)throw new Error('Foreign key violations');
  return {characters,outfits,poses,drafts};
 },{timeout:60000});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const file=process.argv[2];if(!file)throw new Error('Usage: tsx scripts/framing/migrate.ts /absolute/database.db');
 const db=new PrismaClient({datasources:{db:{url:'file:'+resolve(file)}}});
 migrate(db).then(r=>console.log(JSON.stringify(r))).finally(()=>db.$disconnect());
}
