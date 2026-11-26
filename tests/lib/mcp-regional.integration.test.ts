import { installMcpTestPolicy } from "../helpers/mcp-operator-policy";
installMcpTestPolicy();
import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { spawnSync } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const remote = vi.hoisted(() => ({ submit: vi.fn(), objects: new Map<string, Buffer>() }));
vi.mock("@/lib/runpodService", () => ({ default: class { submitJob(...args: any[]) { return remote.submit(...args); } } }));
vi.mock("@/lib/s3Service", () => ({ default: class { async uploadFile(data: Buffer, file: string, mime: string, dir: string) {
  if (mime !== "application/octet-stream") throw Error("Plaintext upload forbidden");
  remote.objects.set(dir + "/" + file, Buffer.from(data)); return { filePath: "/runpod-volume/" + dir + "/" + file };
} } }));
vi.mock("@/lib/settingsService", () => ({ default: class { async getSettings() { return { settings: {
  runpod: { apiKey: "fixture", fieldEncKeyB64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", endpoints: { "qwen-image-edit-maskflow": "fixture-maskflow", "krea2-turbo": "fixture-krea" } },
  s3: { endpointUrl: "https://fixture.invalid", accessKeyId: "fixture", secretAccessKey: "fixture", bucketName: "fixture" },
} }; } } }));
vi.mock("@/lib/runpodSupervisor", () => ({ startRunPodSupervisor: vi.fn() }));
vi.mock("@/lib/galleryEnrichment", () => ({ queueGalleryEnrichment: vi.fn() }));
vi.mock("@/lib/galleryDerivatives", () => ({ queueGalleryDerivatives: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { workspaceContext } from "@/lib/workspaces/context";
import { provisionCredential } from "@/lib/mcp/auth";
import { handleMcpRequest } from "@/lib/mcp/server";
import { processMcpWorkspace } from "@/lib/mcp/worker";
import { getModelsByType, getModelById } from "@/lib/models/modelConfig";
import { decryptStructuredEnvelope, decryptMediaCiphertext } from "@/lib/secureTransport";
import { submitGenerationFormData } from "@/lib/generation/submitFormData";
const scope = <T>(id: string, work: () => T) => workspaceContext.run({ kind: "workspace", workspaceId: id }, async () => await work());
const clients: Client[] = [], dirs: string[] = [];
vi.setConfig({ testTimeout: 15000 });
const rectangle = { kind: "rectangles", regions: [{ x: .25, y: .25, width: .5, height: .5 }] };
beforeAll(() => { if (!process.env.ENGUI_DATABASE_URL?.includes("mcp-test")) throw Error("Isolated database required"); process.env.ENGUI_MCP_ENABLED="1";process.env.ENGUI_MCP_PREPARE_PER_MINUTE="120"; });
beforeEach(() => { remote.submit.mockReset().mockResolvedValue("fixture-remote");remote.objects.clear();vi.stubGlobal("fetch",vi.fn(async()=>{throw Error("No external network");})); });
afterAll(async()=>{await Promise.all(clients.map(c=>c.close()));await prisma.$disconnect();for(const d of dirs)await fs.rm(d,{recursive:true,force:true});vi.unstubAllGlobals();});
async function fixture() {
 const ws=await prisma.workspace.create({data:{id:randomUUID(),userId:"user-with-settings",name:"MaskFlow fixture "+randomUUID()}});
 const dirname=path.join(process.cwd(),"public","generations","maskflow-tests-"+ws.id);dirs.push(dirname);await fs.mkdir(dirname,{recursive:true});
 const token=await provisionCredential(ws.id,["read","generate","curate","cancel"],1);
 const client=new Client({name:"maskflow-test",version:"1"});clients.push(client);
 await client.connect(new StreamableHTTPClientTransport(new URL("http://localhost/api/mcp"),{requestInit:{headers:{Authorization:"Bearer "+token.token,"X-Workspace-Id":ws.id}},fetch:async(input:any,init:any)=>handleMcpRequest(new Request(input,init))}));await client.listTools();
 const call=async(name:string,args:any={})=>{const r=await client.callTool({name,arguments:args});if(r.isError){const e=JSON.parse((r.content as any)[0].text);throw Object.assign(Error(e.message),{code:e.code});}return(r.structuredContent as any).result;};
 const asset=async(color:string,width=512,height=512)=>{const id=randomUUID(),bytes=await sharp({create:{width,height,channels:3,background:color}}).png().toBuffer(),file=path.join(dirname,id+".png");await fs.writeFile(file,bytes);const row=await scope(ws.id,()=>prisma.galleryAsset.create({data:{workspaceId:ws.id,type:"image",bucket:"draft",contentHash:createHash("sha256").update(bytes).digest("hex"),originalUrl:"/generations/maskflow-tests-"+ws.id+"/"+id+".png"}}));return{ref:{kind:"gallery_asset",assetId:row.id},row,file,bytes};};

 const lora=async(name:string,model="krea2-turbo")=>scope(ws.id,()=>prisma.loRA.create({data:{
   workspaceId:ws.id,name,fileName:name+".safetensors",s3Path:"/runpod-volume/loras/workspaces/"+ws.id+"/"+name+".safetensors",
   s3Url:"https://fixture.invalid/"+name,fileSize:BigInt(1),extension:".safetensors",baseModel:model,
   sourceKey:"loras/workspaces/"+ws.id+"/"+name+".safetensors",
   storageTarget:createHash("sha256").update("https://fixture.invalid/fixture").digest("hex"),
 }}));
 const left=await lora("left"),right=await lora("right");
 const regions=[
  {prompt:"left subject",loras:[{id:left.id,weight:0.8}],mask:{kind:"rectangles",regions:[{x:0,y:0,width:0.45,height:1}]}},
  {prompt:"right subject",loras:[{id:right.id,weight:1.1}],mask:{kind:"polygon",points:[{x:.55,y:0},{x:1,y:0},{x:1,y:1},{x:.65,y:1}]}},
 ];
 const plan=(extra:any={})=>call("engui_prepare_generation",{modelId:"krea2-turbo",mode:"text_to_image",prompt:"Two subjects in a shared scene.",regions,width:512,height:512,variantCount:1,seeds:[42],requestKey:randomUUID(),...extra});
 const start=(p:any)=>call("engui_start_generation",{planId:p.planId,planDigest:p.planDigest,requestKey:randomUUID()});
 return{ws,client,call,asset,plan,start,left,right,regions,lora};
}
describe("MCP regional Krea2",()=>{
 it("advertises all three mask kinds and leaves ordinary model modes intact",async()=>{
  const f=await fixture(),m=(await f.call("engui_list_models")).models.find((m:any)=>m.id==="krea2-turbo");
  expect(m.regional).toMatchObject({maskKinds:["rectangles","polygon","image"],maxRegions:4,maxTotalLoras:8,coordinateSystem:"normalized_output"});
  expect(m.modes).toEqual(["text_to_image","image_to_image"]);
  const t=(await f.client.listTools()).tools.find(t=>t.name==="engui_prepare_generation")!;
  expect(t.inputSchema.properties).toHaveProperty("regions");
  expect((await f.call("engui_get_prompt_guide")).markdown).toContain('kind:"polygon"');
 });
 it("freezes each prompt, regional LoRA weight and deterministic mask without paid dispatch",async()=>{
  const f=await fixture(),a=await f.plan(),b=await f.plan();
  expect(a.snapshot.loras).toEqual([]);
  expect(a.snapshot.regions[0].loras[0]).toMatchObject({id:f.left.id,weight:.8});
  expect(a.snapshot.variants[0].regions.map((r:any)=>r.prompt)).toEqual(["left subject","right subject"]);
  expect(a.snapshot.regions.map((r:any)=>r.mask.sha256)).toEqual(b.snapshot.regions.map((r:any)=>r.mask.sha256));
  expect(remote.submit).not.toHaveBeenCalled();
 });
 it.each([{modelId:"z-image"},{mode:"image_to_image"},{parameters:{cfg:2}},{negativePrompt:"bad"},{width:2048,height:2048},{regions:[]}])("rejects unsupported regional request %j",async extra=>{
  const f=await fixture();await expect(f.plan(extra)).rejects.toThrow();expect(remote.submit).not.toHaveBeenCalled();
 });
 it("rejects invalid polygons, out-of-bounds geometry and excessive LoRA slots",async()=>{
  const f=await fixture();
  for(const mask of [
    {kind:"polygon",points:[{x:0,y:0},{x:1,y:1},{x:0,y:1},{x:1,y:0}]},
    {kind:"polygon",points:[{x:0,y:0},{x:.5,y:.5},{x:1,y:1}]},
    {kind:"polygon",points:[{x:0,y:0},{x:1,y:0},{x:0,y:0}]},
    {kind:"polygon",points:[{x:-.1,y:0},{x:1,y:0},{x:1,y:1}]},
    {kind:"rectangles",regions:[{x:.9,y:0,width:.2,height:1}]},
  ]) await expect(f.plan({regions:[{...f.regions[0],mask}]})).rejects.toThrow();
  await expect(f.plan({regions:Array.from({length:4},()=>({...f.regions[0],loras:[{id:f.left.id,weight:1},{id:f.right.id,weight:1}]})),loras:[{id:f.left.id,weight:1}]})).rejects.toThrow();
 });
 it("supports aligned opaque grayscale image masks and rejects colored/empty/misaligned/foreign masks",async()=>{
  const f=await fixture(),m=await f.asset("white"),p=await f.plan({regions:[{...f.regions[0],mask:{kind:"image",source:m.ref}}]});
  expect(p.snapshot.regions[0].mask.sourceSha256).toBe(m.row.contentHash);
  for(const color of ["red","black"]){const m=await f.asset(color);await expect(f.plan({regions:[{...f.regions[0],mask:{kind:"image",source:m.ref}}]})).rejects.toMatchObject({code:"INVALID_MASK"});}
  const small=await f.asset("white",256,512);
  await expect(f.plan({regions:[{...f.regions[0],mask:{kind:"image",source:small.ref}}]})).rejects.toThrow();
  const other=await fixture(),foreign=await other.asset("white");
  await expect(f.plan({regions:[{...f.regions[0],mask:{kind:"image",source:foreign.ref}}]})).rejects.toMatchObject({code:"NOT_FOUND"});
 });
 it("rejects foreign/incompatible LoRAs and stale adapter selection",async()=>{
  const f=await fixture(),other=await fixture(),bad=await f.lora("wrong","z-image");
  for(const id of [other.left.id,bad.id]) await expect(f.plan({regions:[{...f.regions[0],loras:[{id,weight:1}]}]})).rejects.toMatchObject({code:"NOT_FOUND"});
  const p=await f.plan();await scope(f.ws.id,()=>prisma.loRA.update({where:{id:f.left.id},data:{lifecycle:"deleting"}}));
  await expect(f.start(p)).rejects.toThrow();expect(remote.submit).not.toHaveBeenCalled();
 });
 it("fails stale image masks and character-only regional changes before provider submission",async()=>{
  const f=await fixture(),m=await f.asset("white");
  const c=await scope(f.ws.id,()=>prisma.character.create({data:{workspaceId:f.ws.id,name:"Regional subject",traits:JSON.stringify({hair_color:"copper"})}}));
  const regions=[{...f.regions[0],prompt:"{character:"+c.id+"}",mask:{kind:"image",source:m.ref}}];
  const p=await f.plan({regions});
  expect(p.snapshot.characterReferences).toHaveLength(1);
  expect(p.snapshot.variants[0].prompt).not.toContain("copper");
  expect(p.snapshot.variants[0].regions[0].prompt).toContain("copper");
  await scope(f.ws.id,()=>prisma.character.update({where:{id:c.id},data:{traits:JSON.stringify({hair_color:"green"})}}));
  await expect(f.start(p)).rejects.toMatchObject({code:"PLAN_STALE"});
  const p2=await f.plan({regions});await scope(f.ws.id,()=>prisma.galleryAsset.update({where:{id:m.row.id},data:{trashed:true}}));
  await expect(f.start(p2)).rejects.toThrow();expect(remote.submit).not.toHaveBeenCalled();
 });
 it("rejects regional injection through ordinary public form",async()=>{
  const f=await fixture(),form=new FormData();form.set("modelId","krea2-turbo");form.set("workspaceId",f.ws.id);form.set("task_type","regional");
  const res=await scope(f.ws.id,()=>submitGenerationFormData(form));expect(res.status).toBe(400);expect(remote.submit).not.toHaveBeenCalled();
 });
 it("dispatches encrypted per-region adapters, exact polygon masks, global style separately and no plaintext to the provider",async()=>{
  const f=await fixture(),style=await f.lora("style"),p=await f.plan({loras:[{id:style.id,weight:.4}]});
  await f.start(p);await processMcpWorkspace(f.ws.id);expect(remote.submit).toHaveBeenCalledOnce();
  const input=remote.submit.mock.calls[0][0];
  const actual=await vi.importActual<any>("@/lib/runpodService");
  const wire=(new actual.default("fixture","fixture",undefined,"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=") as any).createPayload("krea2-turbo",input).input;
  expect(wire).toMatchObject({mode:"regional",task_type:"regional"});
  expect(wire.prompt).toBeUndefined();expect(wire.lora).toBeUndefined();expect(wire.regional).toBeUndefined();
  expect(JSON.stringify(wire)).not.toContain("left subject");
  const payload=decryptStructuredEnvelope<any>(Buffer.alloc(32),wire._secure,wire._secure.binding);
  expect(payload.lora).toHaveLength(1);expect(payload.lora[0][1]).toBe(.4);
  expect(payload.regional.regions.map((r:any)=>r.loras[0][1])).toEqual([.8,1.1]);
  expect(payload.regional.regions.map((r:any)=>r.prompt)).toEqual(["left subject","right subject"]);
  expect(wire.media_inputs.map((m:any)=>m.role)).toEqual(["region_mask_0","region_mask_1"]);
  for(let i=0;i<2;i++){
    const d=wire.media_inputs[i],cipher=remote.objects.get(d.storage_path.replace("/runpod-volume/",""))!;
    const plain=decryptMediaCiphertext(Buffer.alloc(32),d.envelope,d.envelope.binding,cipher);
    expect(createHash("sha256").update(plain).digest("hex")).toBe(p.snapshot.regions[i].mask.sha256);
    const pixels=await sharp(plain).removeAlpha().greyscale().raw().toBuffer();
    if(i===0){expect(pixels[256*512+100]).toBe(255);expect(pixels[256*512+400]).toBe(0);}
    else {expect(pixels[256*512+100]).toBe(0);expect(pixels[256*512+400]).toBe(255);}
  }
  const job=await scope(f.ws.id,()=>prisma.job.findFirstOrThrow());
  expect(job.options).toContain(f.left.sourceKey);expect(job.options).toContain(f.right.sourceKey);
  expect(await scope(f.ws.id,()=>prisma.workspaceActivity.count({where:{kind:{startsWith:"lora-use:"}}}))).toBe(0);
  // Feed the production Python decryption/mask/graph implementation with TS envelopes.
  const program=`import ast,sys,json,base64,os,tempfile,hashlib
from pathlib import Path
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from krea2_regional_workflow import prepare_regions,configure_regional
root=Path(os.environ["ENGUI_KREA_WORKER_TEST_ROOT"])
names={"decode_encryption_key","serialize_binding","unwrap_dek","decrypt_structured_envelope","decrypt_secure_input","decrypt_media_input_to_file"}
tree=ast.parse((root/"handler.py").read_text())
scope={"os":os,"json":json,"base64":base64,"AESGCM":AESGCM,"WRAPPED_KEY_PREFIX":"v1:"}
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names],type_ignores=[]),"handler.py","exec"),scope)
d=json.load(sys.stdin);inp=scope["decrypt_secure_input"](d["input"])
with tempfile.TemporaryDirectory() as folder:
 for i,m in enumerate(inp["media_inputs"]):
  target=Path(folder)/(str(i)+".bin");target.write_bytes(base64.b64decode(d["objects"][m["storage_path"].replace("/runpod-volume/","")]))
  m["storage_path"]=str(target)
 regions=prepare_regions(inp,folder,512,512,scope["decrypt_media_input_to_file"],lambda entries:entries)
 graph=configure_regional(json.loads((root/"workflow/krea2.json").read_text()),regions)
 print(json.dumps({"count":len(regions),"names":[r["loras"][0][0] for r in regions],"model":graph["3"]["inputs"]["model"]}))
`;
  const worker=process.env.ENGUI_KREA_WORKER_TEST_ROOT!;
  expect(worker).toBeTruthy();
  const python=spawnSync("python3",["-c",program],{env:{...process.env,PYTHONPATH:worker,FIELD_ENC_KEY_B64:"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="},input:JSON.stringify({input:wire,objects:Object.fromEntries([...remote.objects].map(([k,v])=>[k,v.toString("base64")]))}),encoding:"utf8",timeout:15000});
  expect(python.status,python.stderr).toBe(0);expect(JSON.parse(python.stdout)).toMatchObject({count:2,model:["regional_apply",0]});
 },30000);
 it("keeps ordinary requests free of region metadata and mask uploads",async()=>{
  const f=await fixture(),p=await f.plan({regions:undefined,loras:[{id:f.left.id,weight:.7}]});
  expect(p.snapshot).not.toHaveProperty("regions");
  await f.start(p);await processMcpWorkspace(f.ws.id);
  const input=remote.submit.mock.calls[0][0],payload=decryptStructuredEnvelope<any>(Buffer.alloc(32),input._secure,input._secure.binding);
  expect(payload).not.toHaveProperty("regional");expect(payload.lora[0][1]).toBe(.7);
  expect(input.media_inputs).toEqual([]);expect(input.mode).not.toBe("regional");
 });
});
