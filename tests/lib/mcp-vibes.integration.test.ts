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
import { processMcpWorkspace } from "@/lib/mcp/worker";
import { decryptStructuredEnvelope } from "@/lib/secureTransport";
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
  const ws = await prisma.workspace.create({ data: { id: randomUUID(), userId: "user-with-settings", name: "vibes-test-" + randomUUID() } });
  const credential = await provisionCredential(ws.id, scopes, 1);
  const client = new Client({ name: "vibes-test", version: "1" }); clients.push(client);
  await client.connect(new StreamableHTTPClientTransport(new URL("http://localhost/api/mcp"), { requestInit: { headers: { Authorization: "Bearer " + credential.token, "X-Workspace-Id": ws.id } }, fetch: async (i: any, n: any) => handleMcpRequest(new Request(i, n)) }));
  const call = async (name: string, args: any = {}) => {
    const r = await client.callTool({ name, arguments: args });
    if (r.isError) throw Object.assign(Error((r.content as any)[0].text), JSON.parse((r.content as any)[0].text));
    return (r.structuredContent as any).result;
  };
  const create = (extra: any = {}) => call("engui_create_vibe", { name: "Warm film", baseDescription: "Warm cinematic lighting.", tags: [" Warm ", "warm", "Film Grain"], compatibleSceneTypes: ["Portrait"], requestKey: randomUUID(), ...extra });
  const change = (v: any, changes: any, extra: any = {}) => call("engui_update_vibe", { vibeId: v.id, expectedRevision: v.editRevision, changes, requestKey: randomUUID(), ...extra });
  const status = (v: any, action = "delete", extra: any = {}) => call("engui_" + action + "_vibe", { vibeId: v.id, expectedRevision: v.editRevision, requestKey: randomUUID(), ...extra });
  const plan = (v?: any, extra: any = {}) => call("engui_prepare_generation", { modelId: "krea2-turbo", mode: "text_to_image", prompt: "A blue square.", width: 512, height: 512, variantCount: 1, seeds: [42], ...(v ? { vibeId: v.id } : {}), requestKey: randomUUID(), ...extra });
  const start = (p: any, key = randomUUID()) => call("engui_start_generation", { planId: p.planId, planDigest: p.planDigest, requestKey: key });
  const image = async () => {
    const dirname = path.join(process.cwd(), "public", "generations", "mcp-vibes-test-" + ws.id); dirs.push(dirname); await fs.mkdir(dirname, { recursive: true }); await fs.writeFile(path.join(dirname, "source.png"), bytes);
    const asset = await scope(ws.id, () => prisma.galleryAsset.create({ data: { workspaceId: ws.id, type: "image", bucket: "draft", contentHash: createHash("sha256").update(bytes).digest("hex"), originalUrl: "/generations/mcp-vibes-test-" + ws.id + "/source.png" } }));
    return { kind: "gallery_asset", assetId: asset.id };
  };
  return { ws, credential, client, call, create, change, status, plan, start, image };
}
it("discovers full typed CRUD with curate permission, read-only lists and instructions", async () => {
  const f = await fixture(), read = await fixture(["read"]), generate = await fixture(["read", "generate"]);
  const tools = (await f.client.listTools()).tools;
  for (const name of ["list", "get", "create", "update", "delete", "restore"]) expect(tools.some(t => t.name === "engui_" + name + "_vibe" + (name === "list" ? "s" : ""))).toBe(true);
  for (const restricted of [read, generate]) {
    const names = (await restricted.client.listTools()).tools.map(t => t.name);
    expect(names).toContain("engui_get_vibe"); expect(names).not.toContain("engui_create_vibe");
    await expect(restricted.create()).rejects.toThrow();
  }
  const del = tools.find(t => t.name === "engui_delete_vibe")!;
  expect(del.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true, idempotentHint: true });
  expect((await f.call("engui_get_prompt_guide")).markdown).toContain("## Vibe management and generation");
  expect((await f.call("engui_get_context")).operations).toContain("engui_create_vibe");
  expect(remote.submit).not.toHaveBeenCalled();
});
it("creates UI-compatible metadata, reads it and supports old preset discovery", async () => {
  const f = await fixture(), v = await f.create();
  expect(v).toMatchObject({ name: "Warm film", tags: ["warm", "film grain"], compatibleSceneTypes: ["portrait"], status: "active", changed: true });
  expect((await f.call("engui_get_vibe", { vibeId: v.id })).editRevision).toBe(v.editRevision);
  const row = await scope(f.ws.id, () => prisma.vibePreset.findFirst({ where: { id: v.id } }));
  expect(row).toMatchObject({ workspaceId: f.ws.id, tags: '["warm","film grain"]' });
  expect((await f.call("engui_list_presets", { kind: "vibes" })).items[0].id).toBe(v.id);
  expect((await f.call("engui_list_vibes", { query: "grain" })).items[0].id).toBe(v.id);
  expect(remote.submit).not.toHaveBeenCalled();
});
it("preserves omitted fields, clears arrays explicitly and recognizes no-op edits", async () => {
  const f = await fixture(), v = await f.create(), next = await f.change(v, { name: "Cold film" });
  expect(next).toMatchObject({ name: "Cold film", baseDescription: v.baseDescription, tags: v.tags, compatibleSceneTypes: v.compatibleSceneTypes });
  const same = await f.change(next, { name: "Cold film" }); expect(same.changed).toBe(false); expect(same.editRevision).toBe(next.editRevision);
  const cleared = await f.change(next, { tags: [], compatibleSceneTypes: [] }); expect(cleared).toMatchObject({ tags: [], compatibleSceneTypes: [] });
});
it("deduplicates creation and mutations, detects changed-key reuse and never resurrects on replay", async () => {
  const f = await fixture(), key = randomUUID(), v = await f.create({ requestKey: key });
  expect((await f.create({ requestKey: key })).id).toBe(v.id);
  await expect(f.create({ requestKey: key, name: "Other" })).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  const editKey = randomUUID(), updated = await f.change(v, { name: "Edited" }, { requestKey: editKey });
  expect(await f.change(v, { name: "Edited" }, { requestKey: editKey })).toEqual(updated);
  const trash = await f.status(updated);
  expect((await f.create({ requestKey: key })).id).toBe(v.id);
  expect((await f.call("engui_get_vibe", { vibeId: v.id })).status).toBe("trash");
  expect(await scope(f.ws.id, () => prisma.vibePreset.count({ where: { workspaceId: f.ws.id } }))).toBe(1);
  expect((await f.status(trash, "delete")).changed).toBe(false);
});
it("rejects stale agent/UI revisions without overwriting content", async () => {
  const f = await fixture(), v = await f.create(), fresh = await f.change(v, { baseDescription: "Cool blue light." });
  await expect(f.change(v, { name: "Stale" })).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  await expect(f.status(v)).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  await scope(f.ws.id, () => prisma.vibePreset.update({ where: { id: v.id }, data: { tags: '["ui-edit"]' } }));
  await expect(f.change(fresh, { name: "Stale after UI" })).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  expect((await f.call("engui_get_vibe", { vibeId: v.id })).baseDescription).toBe("Cool blue light.");
});
it("trashes/restores reversibly with fresh revisions and excludes trash from active lists", async () => {
  const f = await fixture(), v = await f.create(), key = randomUUID(), trash = await f.status(v, "delete", { requestKey: key });
  expect(await f.status(v, "delete", { requestKey: key })).toEqual(trash);
  expect((await f.call("engui_list_vibes")).items).toEqual([]);
  expect((await f.call("engui_list_presets", { kind: "vibes" })).items).toEqual([]);
  expect((await f.call("engui_list_vibes", { status: "trash" })).items[0].id).toBe(v.id);
  await expect(f.change(trash, { name: "Cannot edit trash" })).rejects.toMatchObject({ code: "VIBE_UNAVAILABLE" });
  const restored = await f.status(trash, "restore"); expect(restored.status).toBe("active");
  expect((await f.plan(restored)).snapshot.vibe.id).toBe(v.id);
});
it("isolates reads, edits, deletes, restore and generation by fixed workspace", async () => {
  const f = await fixture(), other = await fixture(), v = await f.create();
  expect((await other.call("engui_list_vibes")).items).toEqual([]);
  await expect(other.call("engui_get_vibe", { vibeId: v.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(other.change(v, { name: "foreign" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(other.status(v)).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(other.status(v, "restore")).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(other.plan(v)).rejects.toMatchObject({ code: "VIBE_UNAVAILABLE" });
});
it("paginates without duplicates and rejects foreign/filter-mismatched cursors", async () => {
  const f = await fixture(), other = await fixture();
  for (let i = 0; i < 3; i++) await f.create({ name: "Style " + i });
  const a = await f.call("engui_list_vibes", { limit: 2 }), b = await f.call("engui_list_vibes", { limit: 2, cursor: a.nextCursor });
  expect(new Set([...a.items, ...b.items].map((v: any) => v.id)).size).toBe(3); expect(b.nextCursor).toBe(null);
  await expect(f.call("engui_list_vibes", { cursor: a.nextCursor, status: "trash" })).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  await expect(other.call("engui_list_vibes", { cursor: a.nextCursor })).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
});
it.each([{ name: " " }, { baseDescription: "" }, { tags: [1] }, { status: "trash" }, { workspaceId: "foreign" }, { baseDescription: "a".repeat(16001) }])("rejects invalid creation %#", async extra => { const f = await fixture(); await expect(f.create(extra)).rejects.toThrow(); expect(await scope(f.ws.id, () => prisma.vibePreset.count({ where: { workspaceId: f.ws.id } }))).toBe(0); });
it("rejects empty/unknown/null patches without losing metadata", async () => {
  const f = await fixture(), v = await f.create();
  for (const patch of [{}, { name: "" }, { tags: null }, { status: "trash" }, { prompt: "wrong field" }]) await expect(f.change(v, patch)).rejects.toThrow();
  expect((await f.call("engui_get_vibe", { vibeId: v.id })).editRevision).toBe(v.editRevision);
});
it("freezes Vibe before wildcard/Character expansion with no implicit or duplicate prefix", async () => {
  const f = await fixture();
  const c = await f.call("engui_create_character", { name: "Fixture", traits: { hair: "Short silver hair" }, requestKey: randomUUID() });
  await scope(f.ws.id, () => prisma.promptWildcard.create({ data: { workspaceId: f.ws.id, key: "mood", name: "Mood", value: "dreamy", status: "active" } }));
  const v = await f.create({ baseDescription: "{mood} {warm|cool} light." });
  const p = await f.plan(v, { prompt: `{character:${c.characterId}} stands in a courtyard.` });
  expect(p.snapshot.stages.vibePrompt).toBe(v.baseDescription + "\n\n" + p.snapshot.draft.prompt);
  expect(p.snapshot.variants[0].prompt).toMatch(/^dreamy (warm|cool) light\.\n\n/);
  expect(p.snapshot.variants[0].prompt).toContain("Short silver hair"); expect(p.snapshot.characterReferences).toHaveLength(1);
  expect(p.snapshot.vibe).toMatchObject({ id: v.id, baseDescription: v.baseDescription, basePrompt: "" });
  expect((await f.plan()).snapshot.variants[0].prompt).toBe("A blue square.");
  expect(remote.submit).not.toHaveBeenCalled();
});
it.each(["krea2-turbo", "z-image", "qwen-image-edit", "qwen-image-edit-maskflow"])("uses one Vibe prefix in encrypted %s request and preserves settings/references", async modelId => {
  const f = await fixture(), v = await f.create(), source = await f.image();
  const mode = modelId === "qwen-image-edit-maskflow" ? "masked_image_edit" : modelId === "qwen-image-edit" ? "image_edit" : "image_to_image";
  const p = await f.plan(v, { modelId, mode, references: [source], ...(mode === "masked_image_edit" ? { mask: { kind: "rectangles", regions: [{ x: .25, y: .25, width: .5, height: .5 }] } } : {}) });
  const key = randomUUID(), b = await f.start(p, key); await processMcpWorkspace(f.ws.id);
  expect(remote.submit).toHaveBeenCalledOnce();
  const input = remote.submit.mock.calls[0][0], plain = decryptStructuredEnvelope<any>(Buffer.alloc(32), input._secure, input._secure.binding);
  expect(input.prompt).toBeUndefined(); expect(plain.prompt).toBe("Warm cinematic lighting.\n\nA blue square.");
  expect(p.snapshot.variants[0].settings.seed).toBe(42);
  expect(input.media_inputs.length).toBe(mode === "masked_image_edit" ? 2 : 1);
  expect((await f.start(p, key)).batchId).toBe(b.batchId); await processMcpWorkspace(f.ws.id); expect(remote.submit).toHaveBeenCalledOnce();
});
it.each(["description", "trash", "delete"])("rejects stale %s before paid start without rewriting frozen plan", async action => {
  const f = await fixture(), v = await f.create(), p = await f.plan(v);
  if (action === "description") await f.change(v, { baseDescription: "Cool blue light." });
  else if (action === "trash") await f.status(v);
  else await scope(f.ws.id, () => prisma.vibePreset.delete({ where: { id: v.id } }));
  await expect(f.start(p)).rejects.toMatchObject({ code: "PLAN_STALE" });
  expect((await f.call("engui_get_plan", { planId: p.planId })).snapshot).toEqual(p.snapshot);
  expect(remote.submit).not.toHaveBeenCalled();
});
it("rejects queued work after Vibe edits before dispatch, but metadata-only edits are safe", async () => {
  const f = await fixture(), v = await f.create(), p = await f.plan(v), b = await f.start(p);
  const updated = await f.change(v, { baseDescription: "Different atmosphere." }); await processMcpWorkspace(f.ws.id); expect(remote.submit).not.toHaveBeenCalled();
  expect((await f.call("engui_get_batch", { batchId: b.batchId })).variants[0].errorCode).toBe("PLAN_STALE");
  const fresh = await f.plan(updated); await f.change(updated, { tags: ["metadata"] }); await f.start(fresh); await processMcpWorkspace(f.ws.id); expect(remote.submit).toHaveBeenCalledOnce();
});
