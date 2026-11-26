import { beforeAll, beforeEach, afterAll, it, expect, vi } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
vi.mock("@/lib/runpodSupervisor", () => ({ startRunPodSupervisor: vi.fn() }));
vi.mock("@/lib/galleryEnrichment", () => ({ queueGalleryEnrichment: vi.fn() }));
vi.mock("@/lib/galleryDerivatives", () => ({ queueGalleryDerivatives: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { workspaceContext } from "@/lib/workspaces/context";
import { provisionCredential } from "@/lib/mcp/auth";
import { handleMcpRequest } from "@/lib/mcp/server";
import * as gallery from "@/lib/mcp/gallery";
import * as jobs from "@/lib/mcp/jobs";

const scope = <T>(id: string, work: () => T) => workspaceContext.run({ kind: "workspace", workspaceId: id }, work);
const clients: Client[] = [], dirs: string[] = [];
const bytes = Buffer.from("synthetic original; no image decoding needed");
vi.setConfig({ testTimeout: 20000 });
beforeAll(() => {
  if (!process.env.ENGUI_DATABASE_URL?.includes("mcp-test")) throw Error("Isolated database required");
  process.env.ENGUI_MCP_ENABLED = "1";
});
beforeEach(() => { vi.stubGlobal("fetch", vi.fn(async () => { throw Error("External network forbidden"); })); });
afterAll(async () => {
  await Promise.all(clients.map(c => c.close()));
  await prisma.$disconnect();
  for (const dir of dirs) await fs.rm(dir, { recursive: true, force: true });
  vi.unstubAllGlobals();
});
async function fixture(scopes = ["read", "generate", "curate", "cancel"]) {
  const ws = await prisma.workspace.create({ data: { id: randomUUID(), userId: "user-with-settings", name: "bulk-delete-test-" + randomUUID() } });
  const credential = await provisionCredential(ws.id, scopes, 1);
  const client = new Client({ name: "bulk-delete-test", version: "1" }); clients.push(client);
  await client.connect(new StreamableHTTPClientTransport(new URL("http://localhost/api/mcp"), {
    requestInit: { headers: { Authorization: "Bearer " + credential.token, "X-Workspace-Id": ws.id } },
    fetch: async (i: any, n: any) => handleMcpRequest(new Request(i, n)),
  }));
  const call = async (name: string, args: any = {}) => {
    const r = await client.callTool({ name, arguments: args });
    if (r.isError) throw Object.assign(Error((r.content as any)[0].text), JSON.parse((r.content as any)[0].text));
    return (r.structuredContent as any).result;
  };
  const image = async (extra: any = {}) => {
    const dir = path.join(process.cwd(), "public", "generations", "bulk-mcp-test-" + ws.id);
    dirs.push(dir); await fs.mkdir(dir, { recursive: true }); await fs.writeFile(path.join(dir, "original.png"), bytes);
    return scope(ws.id, () => prisma.galleryAsset.create({ data: {
      workspaceId: ws.id, type: "image", bucket: "draft", originalUrl: "/generations/bulk-mcp-test-" + ws.id + "/original.png",
      contentHash: createHash("sha256").update(bytes).digest("hex"), ...extra,
    } }));
  };
  const job = (extra: any = {}) => scope(ws.id, () => prisma.job.create({ data: {
    id: randomUUID(), workspaceId: ws.id, userId: "user-with-settings", type: "image", status: "failed", modelId: "krea2-turbo", ...extra,
  } }));
  const row = (id: string) => scope(ws.id, () => prisma.job.findFirst({ where: { id } }));
  const get = (assetId: string) => call("engui_get_gallery_asset", { assetId });
  const selected = async () => (await call("engui_search_gallery", { limit: 50 })).items.map((a: any) => ({ assetId: a.assetId, expectedRevision: a.editRevision }));
  return { ws, credential, client, call, image, job, row, get, selected };
}
it("discovers typed bulk tools, scopes, annotations, limit and guide", async () => {
  const f = await fixture(), tools = (await f.client.listTools()).tools;
  for (const name of ["engui_delete_jobs", "engui_delete_gallery_assets"]) {
    const tool = tools.find(t => t.name === name)!; expect(tool).toBeDefined();
    expect(tool.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false });
    expect(tool.inputSchema.required).toContain("requestKey");
    expect(tool.outputSchema).toBeDefined();
  }
  expect((await f.call("engui_get_context")).limits.maxDeleteBatchItems).toBe(100);
  expect((await f.call("engui_get_prompt_guide")).markdown).toContain("## Bulk deletion (MCP 2.8)");
  for (const [scopes, allowed] of [[["read"], []], [["read", "generate"], []], [["read", "cancel"], ["engui_delete_jobs"]], [["read", "curate"], ["engui_delete_gallery_assets"]]] as [string[], string[]][]) {
    const restricted = await fixture(scopes), names = (await restricted.client.listTools()).tools.map(t => t.name);
    for (const tool of ["engui_delete_jobs", "engui_delete_gallery_assets"]) expect(names.includes(tool)).toBe(allowed.includes(tool));
    if (!allowed.includes("engui_delete_jobs")) await expect(restricted.call("engui_delete_jobs", { jobIds: [randomUUID()], requestKey: randomUUID() })).rejects.toThrow();
    if (!allowed.includes("engui_delete_gallery_assets")) await expect(restricted.call("engui_delete_gallery_assets", { items: [{ assetId: randomUUID(), expectedRevision: "a".repeat(64) }], requestKey: randomUUID() })).rejects.toThrow();
  }
});
it("deletes mixed completed/failed Jobs but keeps busy work and continues afterwards", async () => {
  const f = await fixture(), done = await f.job({ status: "completed" }), busy = await f.job({ status: "processing", options: '{"runpodJobId":"remote","endpointId":"fixture"}' }), failed = await f.job(), absent = randomUUID();
  const args = { jobIds: [done.id, busy.id, failed.id, absent], requestKey: randomUUID() };
  const result = await f.call("engui_delete_jobs", args);
  expect(result).toMatchObject({ total: 4, succeeded: 3, failed: 1, results: [
    { jobId: done.id, ok: true, alreadyAbsent: false }, { jobId: busy.id, ok: false, error: { code: "JOB_BUSY", retryable: true } },
    { jobId: failed.id, ok: true, alreadyAbsent: false }, { jobId: absent, ok: true, alreadyAbsent: true },
  ] });
  expect(await f.row(done.id)).toBeNull(); expect(await f.row(failed.id)).toBeNull(); expect(await f.row(busy.id)).not.toBeNull();
  await scope(f.ws.id, () => prisma.job.update({ where: { id: busy.id }, data: { status: "completed" } }));
  expect(await f.call("engui_delete_jobs", args)).toEqual(result); expect(await f.row(busy.id)).not.toBeNull();
  expect((await f.call("engui_delete_jobs", { jobIds: [busy.id], requestKey: randomUUID() })).failed).toBe(0);
  expect(globalThis.fetch).not.toHaveBeenCalled();
});
it("trashes multiple images using search revisions, keeps originals, metadata and Jobs", async () => {
  const f = await fixture(), job = await f.job({ status: "completed" });
  const a = await f.image({ sourceJobId: job.id, favorited: true, userTags: '["keep"]' }), b = await f.image({ bucket: "common" });
  const result = await f.call("engui_delete_gallery_assets", { items: await f.selected(), requestKey: randomUUID() });
  expect(result).toMatchObject({ total: 2, succeeded: 2, failed: 0 });
  expect(result.results.every((x: any) => x.ok && x.changed && x.status === "trash")).toBe(true);
  expect((await f.call("engui_search_gallery")).items).toHaveLength(0);
  expect((await f.call("engui_search_gallery", { status: "trash" })).items).toHaveLength(2);
  expect(await f.row(job.id)).not.toBeNull();
  const saved = await scope(f.ws.id, () => prisma.galleryAsset.findFirst({ where: { id: a.id } }));
  expect(saved).toMatchObject({ originalUrl: a.originalUrl, contentHash: a.contentHash, favorited: true, userTags: '["keep"]' });
  expect((await f.get(b.id)).bucket).toBe("common");
  expect(await fs.readFile(path.join(process.cwd(), "public", a.originalUrl))).toEqual(bytes);
});
it("returns stale, foreign and missing Gallery errors alongside valid successes", async () => {
  const f = await fixture(), other = await fixture(), stale = await f.image(), ok = await f.image(), foreign = await other.image();
  const items = await f.selected();
  await scope(f.ws.id, () => prisma.galleryAsset.update({ where: { id: stale.id }, data: { bucket: "common" } }));
  items.unshift({ assetId: foreign.id, expectedRevision: (await other.get(foreign.id)).editRevision });
  items.push({ assetId: randomUUID(), expectedRevision: "a".repeat(64) });
  const result = await f.call("engui_delete_gallery_assets", { items, requestKey: randomUUID() });
  expect(result).toMatchObject({ total: 4, succeeded: 1, failed: 3 });
  expect(result.results.find((x: any) => x.assetId === stale.id).error.code).toBe("REVISION_CONFLICT");
  expect(result.results.filter((x: any) => x.error?.code === "NOT_FOUND")).toHaveLength(2);
  expect((await f.get(stale.id)).status).toBe("active"); expect((await f.get(ok.id)).status).toBe("trash");
  expect((await other.get(foreign.id)).status).toBe("active");
});
it("does not delete foreign Jobs or reveal their existence", async () => {
  const f = await fixture(), other = await fixture(), own = await f.job(), foreign = await other.job();
  const result = await f.call("engui_delete_jobs", { jobIds: [foreign.id, own.id], requestKey: randomUUID() });
  expect(result.results[0]).toEqual({ jobId: foreign.id, ok: true, alreadyAbsent: true });
  expect(await other.row(foreign.id)).not.toBeNull(); expect(await f.row(own.id)).toBeNull();
});
it("replay never re-trashes an image restored after a successful batch", async () => {
  const f = await fixture(), a = await f.image(), args = { items: await f.selected(), requestKey: randomUUID() };
  const result = await f.call("engui_delete_gallery_assets", args), trash = await f.get(a.id);
  await f.call("engui_restore_gallery_asset", { assetId: a.id, expectedRevision: trash.editRevision, requestKey: randomUUID() });
  expect(await f.call("engui_delete_gallery_assets", args)).toEqual(result);
  expect((await f.get(a.id)).status).toBe("active");
});
it("freezes reported revision failures and requires a new key for deliberate retry", async () => {
  const f = await fixture(), a = await f.image(), args = { items: await f.selected(), requestKey: randomUUID() };
  await scope(f.ws.id, () => prisma.galleryAsset.update({ where: { id: a.id }, data: { bucket: "common" } }));
  const result = await f.call("engui_delete_gallery_assets", args); expect(result.failed).toBe(1);
  expect(await f.call("engui_delete_gallery_assets", args)).toEqual(result);
  await expect(f.call("engui_delete_gallery_assets", { ...args, items: await f.selected() })).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  expect((await f.get(a.id)).status).toBe("active");
  expect((await f.call("engui_delete_gallery_assets", { items: await f.selected(), requestKey: randomUUID() })).succeeded).toBe(1);
});
it("resumes an interrupted Job batch and rejects changed payload before further deletion", async () => {
  const f = await fixture(), a = await f.job(), b = await f.job(), c = await f.job(), args = { jobIds: [a.id, b.id], requestKey: randomUUID() };
  const original = jobs.deleteJob;
  const spy = vi.spyOn(jobs, "deleteJob").mockImplementation(async input => {
    if (input.jobId === b.id) throw Error("Simulated interruption");
    return original(input);
  });
  await expect(f.call("engui_delete_jobs", args)).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
  expect(await f.row(a.id)).toBeNull(); expect(await f.row(b.id)).not.toBeNull();
  spy.mockRestore();
  await expect(f.call("engui_delete_jobs", { ...args, jobIds: [a.id, c.id] })).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  expect(await f.row(c.id)).not.toBeNull();
  const resumed = await f.call("engui_delete_jobs", args);
  expect(resumed).toMatchObject({ succeeded: 2, failed: 0, results: [{ jobId: a.id, alreadyAbsent: false }, { jobId: b.id, alreadyAbsent: false }] });
  expect(await f.call("engui_delete_jobs", args)).toEqual(resumed);
});
it("resumes interrupted Gallery work without repeating an already-restored first item", async () => {
  const f = await fixture(), a = await f.image(), b = await f.image();
  const args = { items: [a,b].map(x => ({ assetId: x.id, expectedRevision: gallery.galleryState(x).editRevision })), requestKey: randomUUID() };
  const original = gallery.changeGalleryTrash;
  const spy = vi.spyOn(gallery, "changeGalleryTrash").mockImplementation(async (auth, input, trashed) => {
    if (input.assetId === b.id) throw Error("Simulated interruption");
    return original(auth, input, trashed);
  });
  await expect(f.call("engui_delete_gallery_assets", args)).rejects.toMatchObject({ code: "INTERNAL_ERROR" }); spy.mockRestore();
  const trash = await f.get(a.id);
  await f.call("engui_restore_gallery_asset", { assetId: a.id, expectedRevision: trash.editRevision, requestKey: randomUUID() });
  expect((await f.call("engui_delete_gallery_assets", args)).succeeded).toBe(2);
  expect((await f.get(a.id)).status).toBe("active"); expect((await f.get(b.id)).status).toBe("trash");
});
it("rejects invalid bulk inputs before any deletion", async () => {
  const f = await fixture(), a = await f.image(), job = await f.job(), item = (await f.selected())[0];
  const invalid = [
    ["engui_delete_jobs", { jobIds: [], requestKey: randomUUID() }],
    ["engui_delete_jobs", { jobIds: [job.id, job.id], requestKey: randomUUID() }],
    ["engui_delete_jobs", { jobIds: [job.id,...Array.from({ length: 100 }, () => randomUUID())], requestKey: randomUUID() }],
    ["engui_delete_jobs", { jobIds: [job.id], requestKey: "invalid" }],
    ["engui_delete_jobs", { jobIds: [job.id], requestKey: randomUUID(), force: true }],
    ["engui_delete_gallery_assets", { items: [], requestKey: randomUUID() }],
    ["engui_delete_gallery_assets", { items: [item, item], requestKey: randomUUID() }],
    ["engui_delete_gallery_assets", { items: [item, { assetId: randomUUID() }], requestKey: randomUUID() }],
    ["engui_delete_gallery_assets", { items: [item, { assetId: randomUUID(), expectedRevision: "wrong" }], requestKey: randomUUID() }],
    ["engui_delete_gallery_assets", { items: [item,...Array.from({ length: 100 }, () => ({ assetId: randomUUID(), expectedRevision: "a".repeat(64) }))], requestKey: randomUUID() }],
  ] as [string, any][];
  for (const [name,args] of invalid) await expect(f.call(name,args)).rejects.toThrow();
  expect((await f.get(a.id)).status).toBe("active"); expect(await f.row(job.id)).not.toBeNull();
});
it("treats order as part of idempotency and rejects changed IDs on completed batches", async () => {
  const f = await fixture(), a = await f.job(), b = await f.job(), c = await f.job(), args = { jobIds: [a.id, b.id], requestKey: randomUUID() };
  await f.call("engui_delete_jobs", args);
  await expect(f.call("engui_delete_jobs", { ...args, jobIds: [b.id, a.id] })).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  await expect(f.call("engui_delete_jobs", { ...args, jobIds: [c.id] })).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  expect(await f.row(c.id)).not.toBeNull();
});
it("replays simultaneous identical Gallery batches consistently", async () => {
  const f = await fixture(); await f.image(); await f.image();
  const args = { items: await f.selected(), requestKey: randomUUID() };
  const results = await Promise.all([f.call("engui_delete_gallery_assets", args), f.call("engui_delete_gallery_assets", args)]);
  expect(results[0]).toEqual(results[1]); expect(results[0].succeeded).toBe(2);
});
it("accepts the maximum100 items and counts already-trashed/absent no-ops", async () => {
  const f = await fixture(), a = await f.image({ trashed: true });
  const asset = await f.get(a.id);
  const galleryResult = await f.call("engui_delete_gallery_assets", { items: [{ assetId: a.id, expectedRevision: asset.editRevision }], requestKey: randomUUID() });
  expect(galleryResult).toMatchObject({ succeeded: 1, results: [{ changed: false }] });
  const jobResult = await f.call("engui_delete_jobs", { jobIds: Array.from({ length: 100 }, () => randomUUID()), requestKey: randomUUID() });
  expect(jobResult).toMatchObject({ total: 100, succeeded: 100, failed: 0 });
});
it("deleting Jobs keeps Gallery-backed files even when Gallery records are in Trash", async () => {
  const f = await fixture(), a = await f.image(), job = await f.job({ status: "completed", resultUrl: a.originalUrl });
  await f.call("engui_delete_gallery_assets", { items: await f.selected(), requestKey: randomUUID() });
  expect((await f.call("engui_delete_jobs", { jobIds: [job.id], requestKey: randomUUID() })).succeeded).toBe(1);
  expect((await f.get(a.id)).status).toBe("trash"); expect(await fs.readFile(path.join(process.cwd(), "public", a.originalUrl))).toEqual(bytes);
});
