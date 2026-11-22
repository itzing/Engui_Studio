import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
vi.mock('@/lib/mcp/catalog', () => ({ modelConfiguration: async () => ({configured:true}), selectedLoras: async () => [] }));
import { prisma } from '@/lib/prisma';
import { workspaceContext } from '@/lib/workspaces/context';
import { createBatch } from '@/lib/batch-cards/server';
import { preparePickedZip } from '@/lib/batch-cards/zip';
import { GET } from '@/app/api/batch-cards/[id]/zip/route';
const scope=<T>(id:string,fn:()=>T)=>workspaceContext.run({kind:'workspace',workspaceId:id,userId:'user-with-settings'},async()=>await fn());
const dirs:string[]=[];let png:Buffer,webp:Buffer;
const rows=(n:number)=>['A','B','C'].map((variant,i)=>({id:n===1?'ante_up':'fatal_fortune',key:`c${n}-${variant}`,n,card:`Card ${n}`,class:'Bureaucrat',effect:'Tax',variant,route:'name',prompt:'Fixture',pick:i===0}));
async function fixture() {
  const ws=await prisma.workspace.create({data:{id:randomUUID(),userId:'user-with-settings',name:'Zip '+randomUUID()}});
  const batch=await scope(ws.id,()=>createBatch('Original picks',[...rows(1),...rows(2)]));
  const dir=path.join(process.cwd(),'public/generations/batch-cards',ws.id);dirs.push(dir);await fs.mkdir(dir,{recursive:true});
  await scope(ws.id,async()=>{
    for(const card of batch.document.cards){
      const id=randomUUID(),ext=card.n===1?'.png':'.webp',url=`/generations/batch-cards/${ws.id}/${id}${ext}`;
      await fs.writeFile(path.join(process.cwd(),'public',url),card.n===1?png:webp);
      await prisma.cardBatchTask.create({data:{id,workspaceId:ws.id,batchId:batch.id,cardNumber:card.n,cardRevision:card.revision,variantKey:card.rows[0].key,requestKey:randomUUID(),jobId:randomUUID(),snapshotJson:JSON.stringify({seed:42}),state:'completed',resultUrl:url,thumbnailUrl:'/must-not-export-thumbnail.png'}});
      card.tasks[card.rows[0].key]=id;
    }
    await prisma.cardBatch.update({where:{id:batch.id},data:{documentJson:JSON.stringify(batch.document)}});
  });
  return {ws:ws.id,batch,dir};
}
async function mutate(f:Awaited<ReturnType<typeof fixture>>,fn:(document:any)=>void){fn(f.batch.document);await scope(f.ws,()=>prisma.cardBatch.update({where:{id:f.batch.id},data:{documentJson:JSON.stringify(f.batch.document)}}));}
const archives=async()=>new Set((await fs.readdir(os.tmpdir())).filter(n=>n.startsWith('engui-card-picks-')));
beforeAll(async()=>{if(!process.env.ENGUI_DATABASE_URL?.includes('card-batch-test'))throw Error('Refusing non-test database');vi.stubGlobal('fetch',vi.fn(async()=>{throw Error('Network disabled');}));png=await sharp({create:{width:20,height:30,channels:3,background:'#6688aa'}}).png().toBuffer();webp=await sharp(png).webp().toBuffer();});
afterAll(async()=>{for(const dir of dirs)await fs.rm(dir,{recursive:true,force:true});vi.unstubAllGlobals();await prisma.$disconnect();});
describe('picked-original ZIP export',()=>{
  it('exports original bytes with exact source ids/extensions, verified by Python zipfile CRC',async()=>{
    const f=await fixture(),archive=await scope(f.ws,()=>preparePickedZip(f.batch.id));
    try {const entries=JSON.parse(execFileSync('python3',['-c','import zipfile,sys,json,hashlib\nwith zipfile.ZipFile(sys.argv[1]) as z:\n assert z.testzip() is None\n print(json.dumps({n:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist()}))',archive.archive],{encoding:'utf8'}));expect(entries).toEqual({'ante_up.png':createHash('sha256').update(png).digest('hex'),'fatal_fortune.webp':createHash('sha256').update(webp).digest('hex')});expect(archive.count).toBe(2);expect(archive.size).toBeGreaterThan(png.length+webp.length);}finally{await archive.cleanup();}await expect(fs.stat(path.dirname(archive.archive))).rejects.toThrow();
  });
  it('uses only current Picks and never a superseded attempt or unpicked image',async()=>{
    const f=await fixture();await mutate(f,d=>{d.cards[1].rows[0].pick=false;});
    const task=await scope(f.ws,()=>prisma.cardBatchTask.findFirstOrThrow({where:{batchId:f.batch.id,cardNumber:1}}));
    await scope(f.ws,()=>prisma.cardBatchTask.create({data:{...task,id:randomUUID(),jobId:randomUUID(),requestKey:randomUUID(),cardRevision:0,resultUrl:'/nonexistent-old-result.png'}}));
    const archive=await scope(f.ws,()=>preparePickedZip(f.batch.id));try{expect(execFileSync('unzip',['-Z1',archive.archive],{encoding:'utf8'}).trim()).toBe('ante_up.png');}finally{await archive.cleanup();}
  });
  it('fails clearly for legacy missing ids, duplicate ids and unsafe ids',async()=>{
    const f=await fixture();await mutate(f,d=>{delete d.cards[0].rows[0].id;});await scope(f.ws,()=>expect(preparePickedZip(f.batch.id)).rejects.toThrow('valid id'));
    await mutate(f,d=>{d.cards[0].rows[0].id='../bad';});await scope(f.ws,()=>expect(preparePickedZip(f.batch.id)).rejects.toThrow('valid id'));
    await mutate(f,d=>{d.cards[0].rows[0].id='fatal_fortune';});await scope(f.ws,()=>expect(preparePickedZip(f.batch.id)).rejects.toThrow('Duplicate card id'));
  });
  it('rejects missing or incomplete Picks without creating a partial archive',async()=>{
    const before=await archives(),f=await fixture();const task=f.batch.document.cards[1].tasks['c2-A'];await scope(f.ws,()=>prisma.cardBatchTask.update({where:{id:task},data:{state:'running'}}));await scope(f.ws,()=>expect(preparePickedZip(f.batch.id)).rejects.toThrow('not ready'));
    await scope(f.ws,()=>prisma.cardBatchTask.update({where:{id:task},data:{state:'completed'}}));await fs.rm(path.join(f.dir,task+'.webp'));await scope(f.ws,()=>expect(preparePickedZip(f.batch.id)).rejects.toThrow('unavailable'));expect(await archives()).toEqual(before);
  });
  it('rejects empty selection and foreign workspace access',async()=>{
    const f=await fixture(),other=await fixture();await mutate(f,d=>d.cards.forEach((c:any)=>c.rows.forEach((r:any)=>r.pick=false)));await scope(f.ws,()=>expect(preparePickedZip(f.batch.id)).rejects.toThrow('at least one'));
    const response=await GET(new Request('http://fixture/api/batch-cards/'+f.batch.id+'/zip',{headers:{'x-workspace-id':other.ws}}),{params:Promise.resolve({id:f.batch.id})});expect(response.status).toBe(404);
  });
  it('streams a download with private headers and cleans temporary files on close',async()=>{
    const f=await fixture(),before=await archives();const response=await GET(new Request('http://fixture/api/batch-cards/'+f.batch.id+'/zip',{headers:{'x-workspace-id':f.ws}}),{params:Promise.resolve({id:f.batch.id})});expect(response.status).toBe(200);expect(response.headers.get('content-type')).toBe('application/zip');expect(response.headers.get('content-disposition')).toContain('Original-picks-picks.zip');expect(response.headers.get('cache-control')).toBe('private, no-store');const data=Buffer.from(await response.arrayBuffer());expect(data.readUInt32LE(0)).toBe(0x04034b50);await vi.waitFor(async()=>expect(await archives()).toEqual(before));
  });
  it('cleans a cancelled response and handles an already-aborted request',async()=>{
    const f=await fixture(),before=await archives();const response=await GET(new Request('http://fixture/api/batch-cards/'+f.batch.id+'/zip',{headers:{'x-workspace-id':f.ws}}),{params:Promise.resolve({id:f.batch.id})});await response.body?.cancel();await vi.waitFor(async()=>expect(await archives()).toEqual(before));const controller=new AbortController();controller.abort();await scope(f.ws,()=>expect(preparePickedZip(f.batch.id,controller.signal)).rejects.toThrow());expect(await archives()).toEqual(before);
  });
});
