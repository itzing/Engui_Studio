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
 const asset=async(color:string,width=256,height=256)=>{const id=randomUUID(),bytes=await sharp({create:{width,height,channels:3,background:color}}).png().toBuffer(),file=path.join(dirname,id+".png");await fs.writeFile(file,bytes);const row=await scope(ws.id,()=>prisma.galleryAsset.create({data:{workspaceId:ws.id,type:"image",bucket:"draft",contentHash:createHash("sha256").update(bytes).digest("hex"),originalUrl:"/generations/maskflow-tests-"+ws.id+"/"+id+".png"}}));return{ref:{kind:"gallery_asset",assetId:row.id},row,file,bytes};};
 const source=await asset("#336699");
 const plan=(extra:any={})=>call("engui_prepare_generation",{modelId:"qwen-image-edit-maskflow",mode:"masked_image_edit",prompt:"Replace the selected object with a red sphere.",references:[source.ref],mask:rectangle,width:256,height:256,variantCount:1,seeds:[42],requestKey:randomUUID(),...extra});
 const start=(p:any)=>call("engui_start_generation",{planId:p.planId,planDigest:p.planDigest,requestKey:randomUUID()});
 return{ws,client,call,asset,source,plan,start};
}
describe("MCP MaskFlow secure masked editing",()=>{
 it("advertises masks and stays out of desktop/mobile model lists",async()=>{const f=await fixture();const model=(await f.call("engui_list_models")).models.find((m:any)=>m.id==="qwen-image-edit-maskflow");expect(model).toMatchObject({configured:true,modes:["masked_image_edit"],maxReferences:1,maxLoras:0,mask:{required:true,automaticSegmentation:false}});expect(model.parameters.find((p:any)=>p.name==="steps").default).toBe(50);expect(getModelsByType("image").some(m=>m.id===model.id)).toBe(false);expect(getModelById(model.id)).toBeTruthy();expect((await f.call("engui_get_prompt_guide")).markdown).toContain("normalized");});
 it("freezes deterministic geometry/hash without creating a paid job",async()=>{const f=await fixture(),a=await f.plan(),b=await f.plan();expect(a.snapshot.mask).toMatchObject({input:rectangle,width:256,height:256,sourceSha256:null});expect(a.snapshot.mask.sha256).toBe(b.snapshot.mask.sha256);expect(a.snapshot.variants[0].settings).toMatchObject({steps:50,guidance:4});expect(await scope(f.ws.id,()=>prisma.job.count())).toBe(0);});
 it.each([{mask:undefined},{references:[]},{references:[{kind:"gallery_asset",assetId:"missing"}]},{mode:"image_edit"},{width:2048,height:2048},{negativePrompt:"bad"},{parameters:{cfg:4}},{mask:{kind:"rectangles",regions:[{x:.9,y:0,width:.2,height:1}]}}])("rejects invalid MaskFlow input %j",async extra=>{const f=await fixture();await expect(f.plan(extra)).rejects.toThrow();expect(remote.submit).not.toHaveBeenCalled();});
 it("rejects a mask on ordinary text generation",async()=>{const f=await fixture();await expect(f.plan({modelId:"krea2-turbo",mode:"text_to_image",references:[]})).rejects.toMatchObject({code:"INVALID_ARGUMENT"});});
 it("accepts an owned aligned grayscale image mask and captures original hash",async()=>{const f=await fixture(),m=await f.asset("white"),p=await f.plan({mask:{kind:"image",source:m.ref}});expect(p.snapshot.mask.sourceSha256).toBe(m.row.contentHash);});
 it.each(["black","red"])("rejects unusable image mask %s",async color=>{const f=await fixture(),m=await f.asset(color);await expect(f.plan({mask:{kind:"image",source:m.ref}})).rejects.toMatchObject({code:"INVALID_MASK"});});
 it("rejects foreign and misaligned masks",async()=>{const f=await fixture(),other=await fixture(),m=await other.asset("white");await expect(f.plan({mask:{kind:"image",source:m.ref}})).rejects.toMatchObject({code:"NOT_FOUND"});const small=await f.asset("white",128,128);await expect(f.plan({mask:{kind:"image",source:small.ref}})).rejects.toMatchObject({code:"INVALID_MASK"});});
 it("does not dispatch after an image mask is changed or trashed",async()=>{const f=await fixture(),m=await f.asset("white"),p=await f.plan({mask:{kind:"image",source:m.ref}});await scope(f.ws.id,()=>prisma.galleryAsset.update({where:{id:m.row.id},data:{trashed:true}}));await expect(f.start(p)).rejects.toThrow();expect(remote.submit).not.toHaveBeenCalled();});
 it("prevents public form submission of the MCP-only model",async()=>{const f=await fixture();const form=new FormData();form.set("modelId","qwen-image-edit-maskflow");form.set("workspaceId",f.ws.id);const response=await scope(f.ws.id,()=>submitGenerationFormData(form));expect(response.status).toBe(400);expect(remote.submit).not.toHaveBeenCalled();});
 it("sends encrypted prompt/source/mask and interoperates with the real Python handler",async()=>{
  const f=await fixture(),p=await f.plan();await f.start(p);await processMcpWorkspace(f.ws.id);expect(remote.submit).toHaveBeenCalledOnce();
  const input=remote.submit.mock.calls[0][0];expect(input.prompt).toBeUndefined();expect(input.media_inputs.map((m:any)=>m.role)).toEqual(["source_image","edit_mask"]);
  const payload=decryptStructuredEnvelope<any>(Buffer.alloc(32),input._secure,input._secure.binding);expect(payload).toMatchObject({prompt:p.snapshot.variants[0].prompt,generation:{width:256,height:256,seed:42,steps:50,guidance:4}});
  const mask=input.media_inputs[1],cipher=remote.objects.get(mask.storage_path.replace("/runpod-volume/",""))!;
  const plain=decryptMediaCiphertext(Buffer.alloc(32),mask.envelope,mask.envelope.binding,cipher);expect(createHash("sha256").update(plain).digest("hex")).toBe(p.snapshot.mask.sha256);
  const pixels=await sharp(plain).removeAlpha().greyscale().raw().toBuffer();expect(pixels[0]).toBe(0);expect(pixels[128*256+128]).toBe(255);
  // Independent Python implementation consumes envelopes produced by production TS helpers.
  const program=`import sys,json,base64\nfrom handler import process\nfrom PIL import Image\nd=json.load(sys.stdin)\nclass Store:\n def read(self,k):return base64.b64decode(d['objects'][k])\n def write(self,k,v):self.result=v\ns=Store()\no=process({'input':d['input']},lambda src,mask,prompt,settings:Image.new('RGB',(settings['width'],settings['height']),'red'),s,bytes(32))\nprint(json.dumps({'output':o,'bytes':base64.b64encode(s.result).decode()}))`;
  const python=spawnSync("python3",["-c",program],{env:{...process.env,PYTHONPATH:"/home/engui/Qwen_Image_Edit_MaskFlow"},input:JSON.stringify({input,objects:Object.fromEntries([...remote.objects].map(([k,v])=>[k,v.toString("base64")]))}),encoding:"utf8",timeout:15000});
  expect(python.status,python.stderr).toBe(0);const out=JSON.parse(python.stdout),media=out.output.transport_result.result_media;
  const result=decryptMediaCiphertext(Buffer.alloc(32),media.envelope,{...input._secure.binding,direction:"endpoint_to_engui",role:"result",kind:"image"},Buffer.from(out.bytes,"base64"));expect((await sharp(result).metadata()).width).toBe(256);
 },20000);
});
