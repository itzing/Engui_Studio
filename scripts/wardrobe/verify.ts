import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { migrate, MAPPING, SHOWDOWN } from './migrate';
const beforePath=process.argv[2],afterPath=process.argv[3];
if(!beforePath||!afterPath)throw new Error('Usage: verify.ts before.db migrated.db');
const before=new PrismaClient({datasources:{db:{url:'file:'+beforePath}}});const after=new PrismaClient({datasources:{db:{url:'file:'+afterPath}}});
async function main(){
 const tables:any[]=await before.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");let preserved=0;
 for(const {name} of tables){
  const columns:any[]=await before.$queryRawUnsafe(`PRAGMA table_info("${name}")`);const select=columns.map(c=>`"${c.name}"`).join(',');
  const oldRows:any[]=await before.$queryRawUnsafe(`SELECT ${select} FROM "${name}"`);const newRows:any[]=await after.$queryRawUnsafe(`SELECT ${select} FROM "${name}"`);
  for(const row of oldRows){const current=newRows.find(r=>r.id===row.id);assert(current,`Missing ${name}/${row.id}`);
   const omit=new Set<string>();
   if(name==='characters'&&MAPPING[row.id])['traits','currentVersionId','updatedAt'].forEach(k=>omit.add(k));
   if(name==='studio_session_runs'&&current.templateSnapshotJson!==row.templateSnapshotJson){const old=JSON.parse(row.templateSnapshotJson);const next=JSON.parse(current.templateSnapshotJson);assert(!old.characterPrompt&&MAPPING[old.characterId]);assert(next.characterPrompt&&next.wardrobeMigrationPinned);delete next.characterPrompt;delete next.wardrobeMigrationPinned;delete old.characterPrompt;assert.deepEqual(next,old);omit.add('templateSnapshotJson');omit.add('updatedAt');}
   for(const key of Object.keys(row))if(!omit.has(key))assert.deepEqual(current[key],row[key],`${name}/${row.id}/${key}`);
  }
  if(name!=='character_versions')assert.equal(newRows.length,oldRows.length,name+' row count');preserved++;
 }
 const characters=await after.character.findMany({where:{workspaceId:SHOWDOWN},include:{defaultOutfit:true}});
 assert.equal(characters.filter(c=>MAPPING[c.id]).length,6);
 for(const c of characters.filter(c=>MAPPING[c.id])){assert(c.defaultOutfit);assert.equal(c.defaultOutfit.ownerCharacterId,c.id);const evidence=JSON.parse(c.defaultOutfit.sourceJson);const traits=JSON.parse(c.traits);for(const [k,v]of Object.entries(evidence.originalTraits)){assert(k in traits||k in evidence.movedTraits,'Lost trait '+k);if(k in evidence.movedTraits)assert.equal(evidence.movedTraits[k],v);else if(!['hair_color','hairstyle'].includes(k)||c.name!=='Gambler')assert.equal(traits[k],v);}}
 const all=await after.outfit.findMany();const versions=await after.characterVersion.count();assert.equal((await migrate(after)).migrated,0);assert.deepEqual(await after.outfit.findMany(),all);assert.equal(await after.characterVersion.count(),versions);
 assert.deepEqual(await after.$queryRawUnsafe('PRAGMA foreign_key_check'),[]);
 console.log(JSON.stringify({preservedTables:preserved,originalOutfits:6,idempotent:true}));
}
main().finally(async()=>{await before.$disconnect();await after.$disconnect();});
