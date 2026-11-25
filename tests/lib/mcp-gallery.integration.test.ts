import { installMcpTestPolicy } from "../helpers/mcp-operator-policy";
installMcpTestPolicy();
import { beforeAll, beforeEach, afterAll, it, expect, vi } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const remote = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock("@/lib/runpodService", () => ({ default: class { submitJob(...args: any[]) { return remote.submit(...args); } } }));
vi.mock("@/lib/s3Service", () => ({ default: class { async uploadFile(_data: Buffer, file: string, mime: string, dir: string) { if (mime !== "application/octet-stream") throw Error("Plaintext upload forbidden"); return { filePath: "/runpod-volume/" + dir + "/" + file }; } } }));
vi.mock("@/lib/settingsService", () => ({ default: class { async getSettings() { return { settings: { runpod: { apiKey: "***", fieldEncKeyB64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", endpoints: { "krea2-turbo": "fixture-krea", "z-image": "fixture-z", "qwen-image-edit": "fixture-qwen", "qwen-image-edit-maskflow": "fixture-maskflow" } }, s3: { endpointUrl: "https://fixture.invalid", accessKeyId: "fixture", secretAccessKey: "fixture", bucketName: "fixture" } } }; } } }));
vi.mock("@/lib/runpodSupervisor", () => ({ startRunPodSupervisor: vi.fn() }));
vi.mock("@/lib/galleryEnrichment", () => ({ queueGalleryEnrichment: vi.fn() }));
vi.mock("@/lib/galleryDerivatives", () => ({ queueGalleryDerivatives: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { workspaceContext } from "@/lib/workspaces/context";
import { provisionCredential } from "@/lib/mcp/auth";
import { handleMcpRequest } from "@/lib/mcp/server";
import { preserveVariant } from "@/lib/mcp/curation";
import { digest } from "@/lib/mcp/core";
import { validatePlan, loadPlan } from "@/lib/mcp/plans";

const scope = <T>(id: string, work: () => T) => workspaceContext.run({ kind: "workspace", workspaceId: id }, work);
const clients: Client[] = [], dirs: string[] = [];
let bytes: Buffer;
vi.setConfig({ testTimeout: 20000 });
beforeAll(async () => {
  if (!process.env.ENGUI_DATABASE_URL?.includes("mcp-test")) throw Error("Isolated database required");
  process.env.ENGUI_MCP_ENABLED = "1"; process.env.ENGUI_MCP_PREPARE_PER_MINUTE = "120";
  bytes = await sharp({ create: { width: 512, height: 512, channels: 3, background: "#336699" } }).png().toBuffer();
});
beforeEach(() => { remote.submit.mockReset().mockImplementation(async () => "fixture-" + randomUUID()); vi.stubGlobal("fetch", vi.fn(async () => { throw Error("External network forbidden"); })); });
afterAll(async () => { await Promise.all(clients.map(c => c.close())); await prisma.$disconnect(); for (const d of dirs) await fs.rm(d, { recursive: true, force: true }); vi.unstubAllGlobals(); });
async function fixture(scopes = ["read", "generate", "curate", "cancel"]) {
  const ws = await prisma.workspace.create({ data: { id: randomUUID(), userId: "user-with-settings", name: "gallery-test-" + randomUUID() } });
  const credential = await provisionCredential(ws.id, scopes, 1);
  const client = new Client({ name: "gallery-test", version: "1" }); clients.push(client);
  await client.connect(new StreamableHTTPClientTransport(new URL("http://localhost/api/mcp"), { requestInit: { headers: { Authorization: "Bearer " + credential.token, "X-Workspace-Id": ws.id } }, fetch: async (i: any, n: any) => handleMcpRequest(new Request(i, n)) }));
  const call = async (name: string, args: any = {}) => { const r = await client.callTool({ name, arguments: args }); if (r.isError) throw Object.assign(Error((r.content as any)[0].text), JSON.parse((r.content as any)[0].text)); return (r.structuredContent as any).result; };
  const image = async (extra: any = {}) => {
    const dirname = path.join(process.cwd(), "public", "generations", "mcp-gallery-test-" + ws.id); dirs.push(dirname);dirs.push(path.join(process.cwd(), "public", "generations", "gallery", ws.id));
    await fs.mkdir(dirname, { recursive: true }); await fs.writeFile(path.join(dirname, "source.png"), bytes);
    return scope(ws.id, () => prisma.galleryAsset.create({ data: { workspaceId: ws.id, type: "image", bucket: "draft", contentHash: createHash("sha256").update(bytes).digest("hex"), originalUrl: "/generations/mcp-gallery-test-" + ws.id + "/source.png", ...extra } }));
  };
  const get = (assetId: string) => call("engui_get_gallery_asset", { assetId });
  const save = (assetId: string, extra: any = {}) => call("engui_save_output", { source: { kind: "gallery_asset", assetId }, bucket: "common", requestKey: randomUUID(), ...extra });
  const change = (v: any, action = "delete", extra: any = {}) => call("engui_" + action + "_gallery_asset", { assetId: v.assetId, expectedRevision: v.editRevision, requestKey: randomUUID(), ...extra });
  const plan = (source?: any) => call("engui_prepare_generation", { modelId: "krea2-turbo", mode: source ? "image_to_image" : "text_to_image", references: source ? [source] : [], prompt: "A blue square.", width: 512, height: 512, variantCount: 1, seeds: [42], requestKey: randomUUID() });
  const batch = async () => {
    const p = await plan(), b = await call("engui_start_generation", { planId: p.planId, planDigest: p.planDigest, requestKey: randomUUID() }), v = b.variants[0];
    const a = await image({ sourceJobId: v.jobId, sourceOutputId: "output-1", membershipKey: `job:${v.jobId}:output-1` });
    await scope(ws.id, async () => {
      await prisma.job.create({ data: { id: v.jobId, workspaceId: ws.id, userId: "user-with-settings", type: "image", status: "completed", modelId: "krea2-turbo", resultUrl: a.originalUrl, options: "{}" } });
      await prisma.mcpGenerationVariant.update({ where: { id: v.variantId }, data: { state: "succeeded", assetId: a.id, preservationState: "saved" } });
    });
    return { p, b, v, a };
  };
  return { ws, credential, client, call, image, get, save, change, plan, batch };
}
it("discovers typed Gallery tools with curate scope and destructive annotations", async () => {
  const f = await fixture(), read = await fixture(["read"]), generate = await fixture(["read", "generate"]);
  const tools = (await f.client.listTools()).tools;
  for (const name of ["get", "delete", "restore"]) expect(tools.some(t => t.name === `engui_${name}_gallery_asset`)).toBe(true);
  for (const t of tools.filter(t => ["engui_delete_gallery_asset", "engui_restore_gallery_asset", "engui_save_output"].includes(t.name))) expect(t.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true, idempotentHint: true });
  for (const restricted of [read, generate]) {
    expect((await restricted.client.listTools()).tools.map(t => t.name)).not.toContain("engui_delete_gallery_asset");
    const a = await restricted.image();await expect(restricted.change(await restricted.get(a.id))).rejects.toThrow();
  }
  expect((await f.call("engui_get_prompt_guide")).markdown).toContain("## Gallery curation and Draft promotion");expect(remote.submit).not.toHaveBeenCalled();
});
it("promotes the same asset preserving bytes, tags, favorites, timestamps and provenance", async () => {
  const f = await fixture(), a = await f.image({ favorited: true, userTags: '["keep"]', generationSnapshot: '{"prompt":"original","seed":42}' });
  const moved = await f.save(a.id);expect(moved).toMatchObject({ assetId: a.id, bucket: "common", status: "active", action: "moved", previousBucket: "draft", alreadySaved: false });
  const row = await scope(f.ws.id, () => prisma.galleryAsset.findFirst({ where: { id: a.id } }));
  for (const field of ["originalUrl", "contentHash", "userTags", "favorited", "generationSnapshot", "addedToGalleryAt"] as const) expect(row![field]).toEqual(a[field]);
  expect(await fs.readFile(path.join(process.cwd(), "public", a.originalUrl))).toEqual(bytes);
  expect(await scope(f.ws.id, () => prisma.galleryAsset.count({ where: { workspaceId: f.ws.id } }))).toBe(1);
  expect((await f.call("engui_search_gallery", { bucket: "draft" })).items).toEqual([]);
  expect((await f.call("engui_search_gallery", { bucket: "common" })).items[0]).toMatchObject({ id: a.id, assetId: a.id, status: "active", editRevision: moved.editRevision });
  expect((await f.call("engui_get_image", { source: moved.source })).sha256).toBe(a.contentHash);expect(remote.submit).not.toHaveBeenCalled();
});
it("supports reverse move and true no-op save without a duplicate", async () => {
  const f = await fixture(), a = await f.image(), first = await f.save(a.id), same = await f.save(a.id);
  expect(same).toMatchObject({ action: "unchanged", alreadySaved: true, assetId: a.id, editRevision: first.editRevision });
  expect(await f.save(a.id, { bucket: "draft" })).toMatchObject({ action: "moved", previousBucket: "common", bucket: "draft", assetId: a.id });
});
it("trash and restore are reversible and do not delete shared files or sibling copies", async () => {
  const f = await fixture(), a = await f.image(), sibling = await f.image({ bucket: "common" }), key = randomUUID(), before = await f.get(a.id);
  const trash = await f.change(before, "delete", { requestKey: key });expect(trash).toMatchObject({ status: "trash", bucket: "draft", changed: true, assetId: a.id });
  expect(await f.change(before, "delete", { requestKey: key })).toEqual(trash);
  expect((await f.call("engui_search_gallery", { status: "trash" })).items.map((a: any) => a.id)).toEqual([a.id]);
  expect((await f.call("engui_search_gallery")).items.map((a: any) => a.id)).toEqual([sibling.id]);
  await expect(f.call("engui_get_image", { source: trash.source })).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(f.call("engui_download_artifact", { source: trash.source })).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(f.save(a.id)).rejects.toMatchObject({ code: "GALLERY_TRASHED" });
  expect((await f.change(trash)).changed).toBe(false);
  const restored = await f.change(trash, "restore");expect(restored).toMatchObject({ status: "active", bucket: "draft", assetId: a.id });
  expect((await f.call("engui_get_image", { source: restored.source })).sha256).toBe(a.contentHash);
  expect(await fs.readFile(path.join(process.cwd(), "public", a.originalUrl))).toEqual(bytes);
});
it("rejects stale deletion after promotion or UI metadata change", async () => {
  const f = await fixture(), a = await f.image(), old = await f.get(a.id);await f.save(a.id);
  await expect(f.change(old)).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  const current = await f.get(a.id);await scope(f.ws.id, () => prisma.galleryAsset.update({ where: { id: a.id }, data: { favorited: true } }));
  await expect(f.change(current)).rejects.toMatchObject({ code: "REVISION_CONFLICT" });expect((await f.get(a.id)).status).toBe("active");
});
it("replays historical saves without reapplying a move or resurrection", async () => {
  const f = await fixture(), a = await f.image(), key = randomUUID(), first = await f.save(a.id, { requestKey: key });
  await f.change(first);expect(await f.save(a.id, { requestKey: key })).toEqual(first);expect((await f.get(a.id)).status).toBe("trash");
  await expect(f.save(a.id, { bucket: "draft", requestKey: key })).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
});
it("keeps pre-2.7 save receipts replayable without fabricating current metadata", async () => {
  const f = await fixture(), a = await f.image(), key = randomUUID(), args = { source: { kind: "gallery_asset", assetId: a.id }, bucket: "common", requestKey: key }, result = { assetId: a.id, bucket: "common", sha256: a.contentHash, alreadySaved: false };
  await scope(f.ws.id, () => prisma.mcpOperationReceipt.create({ data: { workspaceId: f.ws.id, operation: "save", requestKey: key, inputDigest: digest(args), resultJson: JSON.stringify(result) } }));
  expect(await f.call("engui_save_output", args)).toEqual(result);expect((await f.get(a.id)).bucket).toBe("draft");
});
it("isolates detail, trash, restore and promotion by workspace", async () => {
  const f = await fixture(), other = await fixture(), a = await f.image(), v = await f.get(a.id);
  expect((await other.call("engui_search_gallery")).items).toEqual([]);
  await expect(other.get(a.id)).rejects.toMatchObject({ code: "NOT_FOUND" });await expect(other.change(v)).rejects.toMatchObject({ code: "NOT_FOUND" });await expect(other.change(v, "restore")).rejects.toMatchObject({ code: "NOT_FOUND" });await expect(other.save(a.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
});
it("rejects incomplete mutation inputs and foreign/filter pagination cursors", async () => {
  const f = await fixture(), other = await fixture();for (let i=0;i<3;i++) await f.image();
  const a = await f.call("engui_search_gallery", { limit: 2, bucket: "draft" });expect(a.nextCursor).not.toBeNull();
  expect((await f.call("engui_search_gallery", { limit: 2, bucket: "draft", cursor: a.nextCursor })).items).toHaveLength(1);
  await expect(f.call("engui_search_gallery", { bucket: "common", cursor: a.nextCursor })).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  await expect(f.call("engui_search_gallery", { bucket: "draft", status: "trash", cursor: a.nextCursor })).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  await expect(other.call("engui_search_gallery", { bucket: "draft", cursor: a.nextCursor })).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  await expect(f.call("engui_delete_gallery_asset", { assetId: a.items[0].id, requestKey: randomUUID() })).rejects.toThrow();
});
it("reports legacy destination duplicates without deleting, copying or reassigning IDs", async () => {
  const f = await fixture(), jobId = randomUUID(), identity = { membershipKey: `job:${jobId}:output-1`, sourceJobId: jobId, sourceOutputId: "output-1" }, a = await f.image(identity), common = await f.image({ ...identity, bucket: "common" });
  await expect(f.save(a.id)).rejects.toMatchObject({ code: "GALLERY_DUPLICATE", details: { sourceAssetId: a.id, existingAssetId: common.id, bucket: "common" } });
  expect((await f.get(a.id)).bucket).toBe("draft");expect((await f.get(common.id)).status).toBe("active");expect(await scope(f.ws.id, () => prisma.galleryAsset.count({ where: { workspaceId: f.ws.id } }))).toBe(2);
  await f.change(await f.get(a.id));expect((await f.get(common.id)).status).toBe("active");
});
it("does not restore a trashed duplicate into an occupied membership", async () => {
  const f = await fixture(), jobId = randomUUID(), a = await f.image({ sourceJobId: jobId, sourceOutputId: "output-1" }), trash = await f.change(await f.get(a.id));
  const other = await f.image({ sourceJobId: jobId, sourceOutputId: "output-1" });
  await expect(f.change(trash, "restore")).rejects.toMatchObject({ code: "GALLERY_DUPLICATE", details: { existingAssetId: other.id } });expect((await f.get(a.id)).status).toBe("trash");
});
it("deduplicates concurrent promotions and concurrent same-key deletes", async () => {
  const f = await fixture(), a = await f.image();const results = await Promise.all([f.save(a.id),f.save(a.id)]);expect(results.every(x=>x.assetId===a.id)).toBe(true);
  const current = await f.get(a.id), key = randomUUID();const [one,two] = await Promise.all([f.change(current,"delete",{requestKey:key}),f.change(current,"delete",{requestKey:key})]);expect(one).toEqual(two);expect(await scope(f.ws.id,()=>prisma.galleryAsset.count({ where: { workspaceId: f.ws.id } }))).toBe(1);
});
it("reuses preserved Job output and reports current Gallery bucket and trash in batch", async () => {
  const f = await fixture(), {p,b,v,a} = await f.batch();
  const saved = await f.call("engui_save_output",{source:{kind:"job_output",jobId:v.jobId,outputId:"output-1"},bucket:"common",requestKey:randomUUID()});expect(saved).toMatchObject({assetId:a.id,action:"moved"});
  let status = await f.call("engui_get_batch",{batchId:b.batchId});expect(status.variants[0]).toMatchObject({assetId:a.id,gallery:{assetId:a.id,bucket:"common",status:"active"}});
  const trash = await f.change(await f.get(a.id));status=await f.call("engui_get_batch",{batchId:b.batchId});expect(status.variants[0]).toMatchObject({assetId:null,preservationState:"trashed",gallery:{assetId:a.id,bucket:"common",status:"trash"}});
  await f.change(trash,"restore");status=await f.call("engui_get_batch",{batchId:b.batchId});expect(status.variants[0].gallery.status).toBe("active");expect((await f.call("engui_get_plan",{planId:p.planId})).snapshot).toEqual(p.snapshot);expect(remote.submit).not.toHaveBeenCalled();
});
it("late automatic preservation reuses a promoted asset and respects its trash state", async () => {
  const f=await fixture(),{v,a}=await f.batch();await f.save(a.id);await f.change(await f.get(a.id));
  await scope(f.ws.id,async()=>{await prisma.mcpGenerationVariant.update({where:{id:v.variantId},data:{assetId:null,preservationState:"pending"}});await preserveVariant({id:v.variantId,jobId:v.jobId,assetId:null});});
  const row=await scope(f.ws.id,()=>prisma.mcpGenerationVariant.findFirst({where:{id:v.variantId}}));expect(row).toMatchObject({assetId:a.id,preservationState:"trashed"});expect(await scope(f.ws.id,()=>prisma.galleryAsset.count({ where: { workspaceId: f.ws.id } }))).toBe(1);
});
it("promoting preserves prepared reference plans; trash makes the source stale", async () => {
  const f=await fixture(),a=await f.image(),p=await f.plan({kind:"gallery_asset",assetId:a.id});await f.save(a.id);
  await scope(f.ws.id,async()=>validatePlan(await loadPlan(p.planId)));
  await f.change(await f.get(a.id));await expect(scope(f.ws.id,async()=>validatePlan(await loadPlan(p.planId)))).rejects.toMatchObject({code:"NOT_FOUND"});expect((await f.call("engui_get_plan",{planId:p.planId})).snapshot).toEqual(p.snapshot);expect(remote.submit).not.toHaveBeenCalled();
});
it("creates an unsaved original once then moves it by Job source", async () => {
  const f=await fixture(),a=await f.image(),jobId=randomUUID();await scope(f.ws.id,()=>prisma.job.create({data:{id:jobId,workspaceId:f.ws.id,userId:"user-with-settings",status:"completed",type:"image",modelId:"krea2-turbo",resultUrl:a.originalUrl}}));
  const args={source:{kind:"job_output",jobId,outputId:"output-1"},bucket:"draft",requestKey:randomUUID()};const created=await f.call("engui_save_output",args);expect(created).toMatchObject({action:"created",previousBucket:null});
  const promoted=await f.call("engui_save_output",{...args,bucket:"common",requestKey:randomUUID()});expect(promoted).toMatchObject({action:"moved",assetId:created.assetId});expect(await scope(f.ws.id,()=>prisma.galleryAsset.count({ where: { workspaceId: f.ws.id } }))).toBe(2);
});
