import { installMcpTestPolicy } from "../helpers/mcp-operator-policy";
installMcpTestPolicy();
import { beforeAll, beforeEach, afterAll, it, expect, vi } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const remote = vi.hoisted(() => ({ submit: vi.fn(), objects: new Map<string, Buffer>() }));
vi.mock("@/lib/runpodService", () => ({ default: class { submitJob(...args: any[]) { return remote.submit(...args); } } }));
vi.mock("@/lib/s3Service", () => ({ default: class { async uploadFile(data: Buffer, file: string, mime: string, dir: string) { if (mime !== "application/octet-stream") throw Error("Plaintext upload forbidden"); remote.objects.set(dir + "/" + file, Buffer.from(data)); return { filePath: "/runpod-volume/" + dir + "/" + file }; } } }));
vi.mock("@/lib/settingsService", () => ({ default: class { async getSettings() { return { settings: { runpod: { apiKey: "***", fieldEncKeyB64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", endpoints: { "krea2-turbo": "fixture-krea", "z-image": "fixture-z", "qwen-image-edit-maskflow": "fixture-maskflow" } }, s3: { endpointUrl: "https://fixture.invalid", accessKeyId: "fixture", secretAccessKey: "fixture", bucketName: "fixture" } } }; } } }));
vi.mock("@/lib/runpodSupervisor", () => ({ startRunPodSupervisor: vi.fn() }));
vi.mock("@/lib/galleryEnrichment", () => ({ queueGalleryEnrichment: vi.fn() }));
vi.mock("@/lib/galleryDerivatives", () => ({ queueGalleryDerivatives: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { workspaceContext } from "@/lib/workspaces/context";
import { provisionCredential } from "@/lib/mcp/auth";
import { handleMcpRequest } from "@/lib/mcp/server";
import { handleUploadRequest } from "@/lib/mcp/uploads";
import { handleArtifactRequest } from "@/lib/mcp/artifacts";
import { processMcpWorkspace } from "@/lib/mcp/worker";
import { decryptStructuredEnvelope, decryptMediaCiphertext } from "@/lib/secureTransport";
const scope = <T>(id: string, work: () => T) => workspaceContext.run({ kind: "workspace", workspaceId: id }, work);
const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const clients: Client[] = [], dirs: string[] = [];
let bytes: Buffer;
vi.setConfig({ testTimeout: 20000 });
beforeAll(async () => { if (!process.env.ENGUI_DATABASE_URL?.includes("mcp-test")) throw Error("Isolated database required"); process.env.ENGUI_MCP_ENABLED="1";process.env.ENGUI_MCP_PREPARE_PER_MINUTE="120";bytes=await sharp({create:{width:512,height:512,channels:3,background:"#336699"}}).png().toBuffer(); });
beforeEach(() => { remote.submit.mockReset().mockResolvedValue("fixture-provider-id");remote.objects.clear();vi.stubGlobal("fetch",vi.fn(async()=>{throw Error("No external network");})); });
afterAll(async()=>{vi.useRealTimers();await Promise.all(clients.map(c=>c.close()));await prisma.$disconnect();for(const d of dirs)await fs.rm(d,{recursive:true,force:true});vi.unstubAllGlobals();});
async function fixture(scopes=["read","generate","cancel"]) {
 const ws=await prisma.workspace.create({data:{id:randomUUID(),userId:"user-with-settings",name:"upload-test-"+randomUUID()}});
 dirs.push(path.join(process.cwd(),"public","uploads","mcp",ws.id));
 dirs.push(path.join(process.cwd(),"public","uploads","dataset-studio",ws.id));
 const credential=await provisionCredential(ws.id,scopes,1),headers={Authorization:"Bearer "+credential.token,"X-Workspace-Id":ws.id};
 const client=new Client({name:"upload-test",version:"1"});clients.push(client);
 await client.connect(new StreamableHTTPClientTransport(new URL("http://localhost/api/mcp"),{requestInit:{headers},fetch:async(i:any,n:any)=>handleMcpRequest(new Request(i,n))}));
 const call=async(name:string,args:any={})=>{const r=await client.callTool({name,arguments:args});if(r.isError)throw Object.assign(Error((r.content as any)[0].text),JSON.parse((r.content as any)[0].text));return(r.structuredContent as any).result;};
 const create=(extra:any={})=>call("engui_create_upload",{filename:"source.png",mimeType:"image/png",byteLength:bytes.length,sha256:hash(bytes),requestKey:randomUUID(),...extra});
 const upload=async()=>{const link=await create(),response=await put(link.uploadUrl,bytes);expect(response.status,JSON.stringify(await response.clone().json())).toBe(200);return{link,result:await response.json()};};
 const plan=(source:any,extra:any={})=>call("engui_prepare_generation",{modelId:"z-image",mode:"image_to_image",references:[source],prompt:"Change the blue object to red.",width:512,height:512,variantCount:1,seeds:[42],parameters:{steps:9,cfg:1,denoise:.6},requestKey:randomUUID(),...extra});
 const start=(p:any,key=randomUUID())=>call("engui_start_generation",{planId:p.planId,planDigest:p.planDigest,requestKey:key});
 return{ws,credential,headers,client,call,create,upload,plan,start};
}
function put(url:string,data:Buffer,extra:RequestInit={}) { return handleUploadRequest(new Request(url,{method:"PUT",body:new Uint8Array(data),headers:{"Content-Type":"image/png"},...extra}),new URL(url).pathname.split("/").at(-1)!); }

import { POST as bridge } from "@/app/api/dataset-studio/route";

async function request(f:any,action:string,extra:any={}) {
 const response=await bridge(new Request("http://localhost/api/dataset-studio",{method:"POST",
  headers:{...f.headers,"Content-Type":"application/json"},body:JSON.stringify({action,...extra})}));
 return {status:response.status,data:await response.json()};
}
async function studioUpload(f:any,requestKey=randomUUID()) {
 const input={filename:"reference.png",mimeType:"image/png",byteLength:bytes.length,sha256:hash(bytes),requestKey};
 const created=await request(f,"create_upload",{input});expect(created.status,JSON.stringify(created.data)).toBe(200);
 if(created.data.status==="ready") return {link:created.data,result:created.data,input};
 const response=await put(created.data.uploadUrl,bytes);
 expect(response.status,JSON.stringify(await response.clone().json())).toBe(200);
 return {link:created.data,result:await response.json(),input};
}
async function studioFixture() {
 process.env.ENGUI_DATASET_STUDIO_ENABLED="1";
 const f=await fixture(),{result}=await studioUpload(f);
 const input={requestKey:randomUUID(),source:result.source,prompt:"Keep {literal} and {character:unresolved} exactly.",
  seed:42,width:512,height:512,steps:8,identity:{ref_boost:1,grounding_px:512,identity_strength:1},
  loras:[],provenance:{datasetId:"1",candidateId:"1"}};
 return {...f,input};
}
it("uses literal upstream prompts and idempotent ordinary encrypted identity jobs",async()=>{
 const f=await studioFixture();
 const first=await request(f,"submit",{input:f.input});expect(first.status,JSON.stringify(first.data)).toBe(200);
 const repeat=await request(f,"submit",{input:f.input});expect(repeat.data).toEqual(first.data);
 await processMcpWorkspace(f.ws.id);
 expect(remote.submit).toHaveBeenCalledOnce();
 const input=remote.submit.mock.calls[0][0];
 expect(input.mode).toBe("identity_edit");expect(input.task).toBe("identity_edit");
 expect(input.task_type).toBe("identity_edit");
 expect(input.media_inputs.map((m:any)=>m.role)).toEqual(["source_image"]);
 const media=input.media_inputs[0],cipher=remote.objects.get(media.storage_path.replace("/runpod-volume/",""))!;
 expect(decryptMediaCiphertext(Buffer.alloc(32),media.envelope,media.envelope.binding,cipher).equals(bytes)).toBe(true);
 const plain=decryptStructuredEnvelope<any>(Buffer.alloc(32),input._secure,input._secure.binding);
 expect(plain.prompt).toBe(f.input.prompt);expect(plain.identity_edit).toEqual(f.input.identity);
 expect(input.prompt).toBeUndefined();
 expect(await scope(f.ws.id,()=>prisma.galleryAsset.count({where:{workspaceId:f.ws.id}}))).toBe(0);
 await processMcpWorkspace(f.ws.id);expect(remote.submit).toHaveBeenCalledOnce();
 const status=await request(f,"status",{requestKey:f.input.requestKey});
 expect(status.status).toBe(200);expect(JSON.stringify(status.data).length).toBeLessThan(2000);
 const other=await fixture();
 expect((await request(other,"status",{requestKey:f.input.requestKey})).status).toBe(404);
 const directory=path.join(process.cwd(),"public","generations","dataset-tests-"+f.ws.id);
 dirs.push(directory);await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,"result.png"),bytes);
 await scope(f.ws.id,()=>prisma.job.update({where:{id:first.data.jobId},data:{status:"completed",resultUrl:"/generations/dataset-tests-"+f.ws.id+"/result.png"}}));
 const artifact=await request(f,"artifact",{requestKey:f.input.requestKey});
 expect(artifact.status,JSON.stringify(artifact.data)).toBe(200);
 const downloadUrl=artifact.data.downloadUrl;
 const download=await handleArtifactRequest(new Request(downloadUrl),new URL(downloadUrl).pathname.split("/").at(-1)!);
 expect(download.status).toBe(200);expect(Buffer.from(await download.arrayBuffer()).equals(bytes)).toBe(true);
 expect(await scope(f.ws.id,()=>prisma.galleryAsset.count({where:{workspaceId:f.ws.id}}))).toBe(0);
});
it("rejects changed idempotent input and read-only credentials without paid submission",async()=>{
 const f=await studioFixture();expect((await request(f,"submit",{input:f.input})).status).toBe(200);
 expect((await request(f,"submit",{input:{...f.input,prompt:"changed"}})).status).toBe(409);
 const readOnly=await fixture(["read"]);
 expect((await request(readOnly,"submit",{input:f.input})).status).toBe(403);
 expect(remote.submit).not.toHaveBeenCalled();
});
it("queued cancellation keeps the provider untouched",async()=>{
 const f=await studioFixture();await request(f,"submit",{input:f.input});
 const r=await request(f,"cancel",{requestKey:f.input.requestKey,cancelKey:randomUUID()});
 expect(r.status,JSON.stringify(r.data)).toBe(200);
 await processMcpWorkspace(f.ws.id);expect(remote.submit).not.toHaveBeenCalled();
});
it("rejects unsupported payloads and stays disabled by default",async()=>{
 const f=await studioFixture();
 for(const change of [{width:513},{identity:{ref_boost:NaN}},{source:{kind:"url",url:"https://example.test"}}]){
   expect((await request(f,"submit",{input:{...f.input,...change}})).status).toBe(400);
 }
 process.env.ENGUI_DATASET_STUDIO_ENABLED="0";
 expect((await request(f,"capabilities")).status).toBe(404);
 process.env.ENGUI_DATASET_STUDIO_ENABLED="1";
 expect(remote.submit).not.toHaveBeenCalled();
});


it.each([
 {host:"127.0.0.1:3010",forwarded:"",origin:"http://127.0.0.1:3010"},
 {host:"bridge.example.test",forwarded:"https",origin:"https://bridge.example.test"},
])("keeps signed uploads on the authenticated request origin: $origin",async({host,forwarded,origin})=>{
 process.env.ENGUI_DATASET_STUDIO_ENABLED="1";
 const previous=process.env.ENGUI_MCP_ALLOWED_HOSTS;
 process.env.ENGUI_MCP_ALLOWED_HOSTS="bridge.example.test";
 try {
  const f=await fixture();
  const response=await bridge(new Request("http://localhost:3010/api/dataset-studio",{
   method:"POST",headers:{...f.headers,Host:host,"X-Forwarded-Proto":forwarded,"Content-Type":"application/json"},
   body:JSON.stringify({action:"create_upload",input:{filename:"reference.png",mimeType:"image/png",byteLength:bytes.length,sha256:hash(bytes),requestKey:randomUUID()}})
  }));
  expect(response.status).toBe(200);
  expect(new URL((await response.json()).uploadUrl).origin).toBe(origin);
  expect(remote.submit).not.toHaveBeenCalled();
 } finally {
  if(previous===undefined)delete process.env.ENGUI_MCP_ALLOWED_HOSTS;
  else process.env.ENGUI_MCP_ALLOWED_HOSTS=previous;
 }
});


it("keeps Studio inputs independent of Gallery and namespaces old upload keys",async()=>{
 process.env.ENGUI_DATASET_STUDIO_ENABLED="1";
 const f=await fixture(),old=await f.upload();
 await scope(f.ws.id,()=>prisma.galleryAsset.update({where:{id:old.result.source.assetId},data:{trashed:true}}));
 const before=await scope(f.ws.id,()=>prisma.galleryAsset.count({where:{workspaceId:f.ws.id}}));
 const current=await studioUpload(f,old.link.uploadId);
 expect(current.result.source).toEqual({kind:"dataset_upload",uploadId:old.link.uploadId});
 expect(await scope(f.ws.id,()=>prisma.galleryAsset.count({where:{workspaceId:f.ws.id}}))).toBe(before);
 const again=await request(f,"create_upload",{input:current.input});
 expect(again.data.status).toBe("ready");expect(again.data.source).toEqual(current.result.source);
 expect((await request(f,"get_upload",{uploadId:old.link.uploadId})).data.status).toBe("ready");
 const oldAsset=await scope(f.ws.id,()=>prisma.galleryAsset.findUnique({where:{id:old.result.source.assetId}}));
 expect(oldAsset?.trashed).toBe(true);
 const files=await scope(f.ws.id,()=>prisma.workspaceFile.findMany({where:{workspaceId:f.ws.id}}));
 expect(files.some(x=>x.location.includes("/uploads/dataset-studio/"))).toBe(true);
 expect(remote.submit).not.toHaveBeenCalled();
});

it("scopes internal uploads to the creating credential and excludes them from public MCP",async()=>{
 const f=await studioFixture(),uploadId=f.input.source.uploadId;
 const other=await fixture();
 expect((await request(other,"get_upload",{uploadId})).status).toBe(404);
 const second=await provisionCredential(f.ws.id,["read","generate","cancel"],1);
 const sameWorkspace={headers:{Authorization:"Bearer "+second.token,"X-Workspace-Id":f.ws.id}};
 expect((await request(sameWorkspace,"get_upload",{uploadId})).status).toBe(404);
 expect((await request(sameWorkspace,"submit",{input:f.input})).status).toBe(404);
 await expect(f.call("engui_get_upload",{uploadId})).rejects.toThrow();
 await expect(f.plan(f.input.source)).rejects.toThrow();
 expect(await scope(f.ws.id,()=>prisma.galleryAsset.count({where:{workspaceId:f.ws.id}}))).toBe(0);
 expect(remote.submit).not.toHaveBeenCalled();
});

it("binds the internal lane in signed links and respects bridge disablement",async()=>{
 process.env.ENGUI_DATASET_STUDIO_ENABLED="1";
 const f=await fixture();
 const c=await request(f,"create_upload",{input:{filename:"reference.png",mimeType:"image/png",byteLength:bytes.length,sha256:hash(bytes),requestKey:randomUUID()}});
 const url=new URL(c.data.uploadUrl),token=url.pathname.split("/").at(-1)!;
 const [encoded,mac]=token.split("."),payload=JSON.parse(Buffer.from(encoded,"base64url").toString());
 delete payload.lane;
 const changed=Buffer.from(JSON.stringify(payload)).toString("base64url")+"."+mac;
 url.pathname=url.pathname.replace(token,changed);
 expect((await put(url.href,bytes)).status).toBe(401);
 process.env.ENGUI_DATASET_STUDIO_ENABLED="0";
 try {expect((await put(c.data.uploadUrl,bytes)).status).toBe(404);}
 finally {process.env.ENGUI_DATASET_STUDIO_ENABLED="1";}
 expect(await scope(f.ws.id,()=>prisma.galleryAsset.count({where:{workspaceId:f.ws.id}}))).toBe(0);
});

it("retains legacy source support without rewriting accepted snapshots",async()=>{
 const f=await studioFixture(),legacy=await f.upload();
 f.input.source=legacy.result.source;
 const submitted=await request(f,"submit",{input:f.input});expect(submitted.status).toBe(200);
 expect((await request(f,"submit",{input:f.input})).data).toEqual(submitted.data);
 await processMcpWorkspace(f.ws.id);expect(remote.submit).toHaveBeenCalledOnce();
 expect(await scope(f.ws.id,()=>prisma.galleryAsset.count({where:{workspaceId:f.ws.id}}))).toBe(1);
});
