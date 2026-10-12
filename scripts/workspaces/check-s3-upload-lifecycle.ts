import assert from 'node:assert/strict';
import { prisma } from '../../src/lib/prisma';
import { workspaceContext } from '../../src/lib/workspaces/context';
import { startLoraUpload, putLoraPart, finishLoraUpload, abortLoraUpload } from '../../src/lib/workspaces/loraUpload';
import { deleteLora } from '../../src/lib/workspaces/loraAccess';
import { beginWorkspaceDeletion, resumeWorkspaceDeletion } from '../../src/lib/workspaces/deletion';
async function main() {
 assert.equal(process.env.ENGUI_ALLOW_STORAGE_FIXTURE,'1','Opt in to a tiny temporary storage fixture.');
 assert.ok(process.env.ENGUI_DATABASE_URL?.includes('verification.db'),'Only use the isolated database.');
 const workspace=await prisma.workspace.create({data:{userId:'user-with-settings',name:'Storage fixture '+Date.now()}});
 const scope=<T>(fn:()=>Promise<T>)=>workspaceContext.run({kind:'workspace',workspaceId:workspace.id,userId:workspace.userId,revision:0},async()=>await fn());
 let binding:Awaited<ReturnType<typeof startLoraUpload>>|undefined;
 let loraId:string|undefined;
 try {
  const bytes=Buffer.from('Engui owned upload lifecycle fixture\n');
  binding=await scope(()=>startLoraUpload({fileName:'workspace-upload-fixture.safetensors',fileSize:bytes.length,baseModel:'z-image'}));
  assert.ok(binding.key.startsWith('loras/workspaces/'+workspace.id+'/'));
  assert.notEqual(binding.key,'loras/workspaces/'+workspace.id+'/workspace-upload-fixture.safetensors','The physical object key must have a unique server identity.');
  await scope(()=>putLoraPart({...binding!,partNumber:1,body:bytes}));
  const row=await scope(()=>finishLoraUpload(binding!));loraId=row.id;
  const repeat=await scope(()=>finishLoraUpload(binding!));
  assert.equal(row.id,repeat.id);
  assert.equal(row.fileName,'workspace-upload-fixture.safetensors');
  console.log(JSON.stringify({phase:'verified',upload:true,parts:true,finalize:true,retry:true,uniqueObject:true,fileNamePreserved:true}));
 } finally {
  if(loraId) await scope(()=>deleteLora(loraId!));
  else if(binding) await scope(()=>abortLoraUpload(binding!));
  await beginWorkspaceDeletion(workspace.id,workspace.name);
  await resumeWorkspaceDeletion(workspace.id);
  const op=await prisma.workspaceDeletion.findUniqueOrThrow({where:{workspaceId:workspace.id}});
  assert.equal(op.status,'completed',op.error||'Fixture cleanup pending.');
  console.log(JSON.stringify({phase:'cleanup',workspaceDeleted:true,ownedS3ObjectsDeleted:true}));
 }
}
main().catch(e=>{console.error(JSON.stringify({passed:false,name:e.name,message:e.message}));process.exitCode=1}).finally(()=>prisma.$disconnect());
