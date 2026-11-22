import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
vi.mock('@/lib/mcp/catalog', () => ({ modelConfiguration: async () => ({configured:true}), selectedLoras: async () => [] }));
vi.mock('@/lib/generation/submitFormData', () => ({ submitPreparedGeneration: vi.fn(async () => { throw Error('Real provider disabled'); }) }));
import { prisma } from '@/lib/prisma';
import { workspaceContext } from '@/lib/workspaces/context';
import { createBatch, readBatch, updateBatch, queueVariants, exportBatch } from '@/lib/batch-cards/server';
import { processCardBatchWorkspace, batchProvider } from '@/lib/batch-cards/worker';
import { cardIsReady } from '@/lib/batch-cards/types';
import { POST } from '@/app/api/batch-cards/route';
import { PATCH, GET } from '@/app/api/batch-cards/[id]/route';
const scope=<T>(id:string, fn:()=>T)=>workspaceContext.run({kind:'workspace',workspaceId:id,userId:'user-with-settings'},async()=>await fn());
const rows=(n=1)=>['A','B','C'].map((variant,i)=>({key:`c${n}-${variant}`,n,card:`Card ${n}`,class:'Bureaucrat',effect:'Tax: 10 chips',variant,route:['name','effect','unexpected'][i],pick:i===0,stylePack:'base',prompt:'Exact {red|blue} prompt. ',custom:'preserved'}));
const dirs:string[]=[];let bytes:Buffer;let beforeBoundary:(()=>Promise<void>)|undefined;let failure:'unknown'|'rejected'|undefined;
const submitted:{form:FormData;prepared:any}[]=[];
async function fixture() { const ws=await prisma.workspace.create({data:{id:randomUUID(),userId:'user-with-settings',name:'Batch test '+randomUUID()}}); const batch=await scope(ws.id,()=>createBatch('Deck',[...rows(),...rows(2)])); dirs.push(path.join(process.cwd(),'public/generations/batch-cards',ws.id)); return {ws:ws.id,batch}; }
async function complete(ws:string,id:string) { const dir=path.join(process.cwd(),'public/generations/batch-test-'+ws); dirs.push(dir); await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'fixture.png'),bytes);await scope(ws,()=>prisma.job.update({where:{id},data:{status:'completed',resultUrl:'/generations/batch-test-'+ws+'/fixture.png',thumbnailUrl:null}})); }
beforeAll(async()=>{
 if(!process.env.ENGUI_DATABASE_URL?.includes('card-batch-test')) throw Error('Refusing non-test database');
 vi.stubGlobal('fetch',vi.fn(async()=>{throw Error('Network prohibited in batch tests');}));
 bytes=await sharp({create:{width:32,height:32,channels:3,background:'#446688'}}).png().toBuffer();
 batchProvider.submit=vi.fn(async(form,prepared)=>{
  submitted.push({form,prepared});const jobId=String(form.get('jobId')),workspaceId=String(form.get('workspaceId'));
  await prisma.job.create({data:{id:jobId,workspaceId,userId:'user-with-settings',status:'queueing_up',type:'image',modelId:'krea2-turbo',prompt:prepared.prompt}});
  if(beforeBoundary) {const fn=beforeBoundary;beforeBoundary=undefined;await fn();}
  await prepared.beforeProviderSubmit({endpointId:'fixture',secureState:{activeAttempt:{}}});
  if(failure==='unknown'){failure=undefined;throw Error('Lost response');}
  if(failure==='rejected'){failure=undefined;return Response.json({code:'PROVIDER_REJECTED'},{status:400});}
  await prepared.afterProviderAccepted('remote-'+jobId); return Response.json({success:true,jobId});
 });
});
afterAll(async()=>{for(const dir of dirs)await fs.rm(dir,{recursive:true,force:true});vi.unstubAllGlobals();await prisma.$disconnect();});
describe('durable batch service and worker (isolated database, fake provider)',()=>{
 it('import is atomic and export preserves unknown fields',async()=>{const f=await fixture();await scope(f.ws,async()=>{expect(await exportBatch(f.batch.id)).toEqual([...rows(),...rows(2)]);await expect(createBatch('Invalid',rows().slice(0,2))).rejects.toThrow();expect(await prisma.cardBatch.count()).toBe(1);});});
 it('queues once, exports current Picks, preserves output after job deletion and resets Pick on regeneration',async()=>{const f=await fixture(),key=randomUUID();let view=await scope(f.ws,()=>queueVariants(f.batch.id,0,['c1-A'],key));expect(view.tasks).toHaveLength(1);expect(cardIsReady(view.document.cards[0],view.tasks)).toBe(false);const duplicate=await scope(f.ws,()=>queueVariants(f.batch.id,0,['c1-A'],key));expect(duplicate.tasks[0].id).toBe(view.tasks[0].id);await scope(f.ws,()=>expect(queueVariants(f.batch.id,0,['c1-B'],key)).rejects.toThrow('different'));
 await processCardBatchWorkspace(f.ws);expect(submitted.at(-1)!.form.get('prompt')).toBe(rows()[0].prompt);expect(submitted.at(-1)!.prepared.prompt).toBe(rows()[0].prompt);await complete(f.ws,view.tasks[0].jobId);await processCardBatchWorkspace(f.ws);
 view=await scope(f.ws,()=>readBatch(f.batch.id));expect(cardIsReady(view.document.cards[0],view.tasks)).toBe(true);expect(view.tasks[0].resultUrl).toContain('/generations/batch-cards/');await scope(f.ws,()=>prisma.job.delete({where:{id:view.tasks[0].jobId}}));view=await scope(f.ws,()=>readBatch(f.batch.id));expect(cardIsReady(view.document.cards[0],view.tasks)).toBe(true);
 view=await scope(f.ws,()=>updateBatch(f.batch.id,view.revision,{kind:'pick',cardNumber:1,key:'c1-A'}));expect(view.document.cards[0].rows[0].pick).toBe(false);view=await scope(f.ws,()=>updateBatch(f.batch.id,view.revision,{kind:'pick',cardNumber:1,key:'c1-A'}));expect(view.document.cards[0].rows[0].pick).toBe(true);
 view=await scope(f.ws,()=>queueVariants(f.batch.id,view.revision,['c1-A'],randomUUID()));expect(view.document.cards[0].rows[0].pick).toBe(false);
 });
 it('blocks duplicate active attempts and stale tab writes',async()=>{const f=await fixture();const v=await scope(f.ws,()=>queueVariants(f.batch.id,0,['c1-B','c1-C'],randomUUID()));await scope(f.ws,()=>expect(queueVariants(f.batch.id,v.revision,['c1-B'],randomUUID())).rejects.toThrow('active'));await scope(f.ws,()=>expect(updateBatch(f.batch.id,0,{kind:'pick',cardNumber:1,key:'c1-A'})).rejects.toThrow('another tab'));await scope(f.ws,()=>expect(updateBatch(f.batch.id,v.revision,{kind:'pick',cardNumber:1,key:'c1-B'})).rejects.toThrow('Generate'));});
 it('reimport cancels queued attempts and late old results never attach to the replacement',async()=>{const f=await fixture();let v=await scope(f.ws,()=>queueVariants(f.batch.id,0,['c1-A','c1-B'],randomUUID()));await processCardBatchWorkspace(f.ws);const old=await scope(f.ws,()=>prisma.cardBatchTask.findFirstOrThrow({where:{batchId:f.batch.id,state:'running'}}));v=await scope(f.ws,()=>updateBatch(f.batch.id,v.revision,{kind:'replace',cardNumber:1,rows:rows().map(r=>({...r,prompt:'replacement'}))}));expect(v.document.cards[0].rows.every(r=>!r.pick)).toBe(true);expect(v.document.cards[1].rows[0].pick).toBe(true);expect(v.tasks).toHaveLength(0);await complete(f.ws,old.jobId);await processCardBatchWorkspace(f.ws);v=await scope(f.ws,()=>readBatch(f.batch.id));expect(v.tasks).toHaveLength(0);expect(v.document.cards[0].tasks).toEqual({});expect(await scope(f.ws,()=>prisma.cardBatchTask.count({where:{state:'cancelled'}}))).toBe(1);});
 it('reimport during preparation stops the provider boundary',async()=>{const f=await fixture();let v=await scope(f.ws,()=>queueVariants(f.batch.id,0,['c1-A'],randomUUID()));beforeBoundary=async()=>{await updateBatch(f.batch.id,v.revision,{kind:'replace',cardNumber:1,rows:rows()});};await processCardBatchWorkspace(f.ws);const task=await scope(f.ws,()=>prisma.cardBatchTask.findFirstOrThrow({where:{batchId:f.batch.id}}));expect(task.boundaryAt).toBeNull();expect(task.providerJobId).toBeNull();expect(task.state).toBe('failed');});
 it('ambiguous acceptance is never automatically retried, including after restart',async()=>{const f=await fixture();let v=await scope(f.ws,()=>queueVariants(f.batch.id,0,['c1-A'],randomUUID()));failure='unknown';const count=submitted.length;await processCardBatchWorkspace(f.ws);await processCardBatchWorkspace(f.ws);v=await scope(f.ws,()=>readBatch(f.batch.id));expect(v.tasks[0].state).toBe('submission_unknown');expect(submitted.length).toBe(count+1);await scope(f.ws,()=>expect(queueVariants(f.batch.id,v.revision,['c1-A'],randomUUID())).rejects.toThrow('active'));
 await scope(f.ws,()=>prisma.cardBatchTask.update({where:{id:v.tasks[0].id},data:{state:'submitting',leaseUntil:new Date(0)}}));await processCardBatchWorkspace(f.ws);expect((await scope(f.ws,()=>readBatch(f.batch.id))).tasks[0].state).toBe('submission_unknown');expect(submitted.length).toBe(count+1);});
 it('explicit provider rejection permits a new user-requested attempt',async()=>{const f=await fixture();let v=await scope(f.ws,()=>queueVariants(f.batch.id,0,['c1-A'],randomUUID()));failure='rejected';await processCardBatchWorkspace(f.ws);v=await scope(f.ws,()=>readBatch(f.batch.id));expect(v.tasks[0].state).toBe('failed');v=await scope(f.ws,()=>queueVariants(f.batch.id,v.revision,['c1-A'],randomUUID()));expect(v.tasks[0].state).toBe('queued');});
 it('isolates workspaces and validates API mutation revisions',async()=>{const a=await fixture(),b=await fixture();await scope(b.ws,()=>expect(readBatch(a.batch.id)).rejects.toThrow('not found'));const headers={'content-type':'application/json','x-workspace-id':a.ws};const created=await POST(new Request('http://fixture/api/batch-cards',{method:'POST',headers,body:JSON.stringify({title:'API deck',rows:rows()})}));expect(created.status).toBe(200);const v=await created.json();const context={params:Promise.resolve({id:v.id})};const patch=await PATCH(new Request('http://fixture/api/batch-cards/'+v.id,{method:'PATCH',headers,body:JSON.stringify({revision:0,kind:'pick',cardNumber:1,key:'c1-A'})}),context);expect(patch.status).toBe(200);const stale=await PATCH(new Request('http://fixture/api/batch-cards/'+v.id,{method:'PATCH',headers,body:JSON.stringify({revision:0,kind:'pick',cardNumber:1,key:'c1-A'})}),context);expect(stale.status).toBe(409);const foreign=await GET(new Request('http://fixture/api/batch-cards/'+v.id,{headers:{'x-workspace-id':b.ws}}),context);expect(foreign.status).toBe(404);});
});
