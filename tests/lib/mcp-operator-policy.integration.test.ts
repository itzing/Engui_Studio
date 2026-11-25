import { beforeAll, beforeEach, afterAll, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const remote = vi.hoisted(() => ({ submit: vi.fn(), configured: true }));
vi.mock("@/lib/runpodService", () => ({ default: class { submitJob(...args: any[]) { return remote.submit(...args); } } }));
vi.mock("@/lib/s3Service", () => ({ default: class { async uploadFile(_data: Buffer, file: string, mime: string, dir: string) { if (mime !== "application/octet-stream") throw Error("Plaintext upload forbidden"); return { filePath: "/runpod-volume/" + dir + "/" + file }; } } }));
vi.mock("@/lib/settingsService", () => ({ default: class { async getSettings() { return { settings: { runpod: { apiKey: "***", fieldEncKeyB64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", endpoints: remote.configured ? { "krea2-turbo": "fixture-krea", "z-image": "fixture-z", "qwen-image-edit": "fixture-qwen", "qwen-image-edit-maskflow": "fixture-maskflow" } : {} }, s3: { endpointUrl: "https://fixture.invalid", accessKeyId: "fixture", secretAccessKey: "fixture", bucketName: "fixture" } } }; } } }));
vi.mock("@/lib/runpodSupervisor", () => ({ startRunPodSupervisor: vi.fn() }));
vi.mock("@/lib/galleryEnrichment", () => ({ queueGalleryEnrichment: vi.fn() }));
vi.mock("@/lib/galleryDerivatives", () => ({ queueGalleryDerivatives: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { workspaceContext } from "@/lib/workspaces/context";
import { provisionCredential } from "@/lib/mcp/auth";
import { handleMcpRequest } from "@/lib/mcp/server";
import { processMcpWorkspace, providerAdapter } from "@/lib/mcp/worker";
import { readOperatorPolicy } from "@/lib/mcp/operator-policy";
const scope = <T>(id: string, work: () => T) => workspaceContext.run({ kind: "workspace", workspaceId: id }, work);
const clients: Client[] = [];
let directory: string, filename: string, previous: string | undefined;
const allowed = ["krea2-turbo", "z-image"];
async function policy(models = allowed, workspacePreferences: Record<string, { preferredVibeId: string }> = {}) {
  await fs.writeFile(filename + ".new", JSON.stringify({ enabledModels: models, workspacePreferences }));
  await fs.rename(filename + ".new", filename);
}
vi.setConfig({ testTimeout: 20000 });
beforeAll(async () => {
  if (!process.env.ENGUI_DATABASE_URL?.includes("mcp-test")) throw Error("Isolated database required");
  previous = process.env.ENGUI_MCP_POLICY_PATH;
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "mcp-operator-test-")); filename = path.join(directory, "policy.json");
  process.env.ENGUI_MCP_POLICY_PATH = filename;
  process.env.ENGUI_MCP_ENABLED = "1"; process.env.ENGUI_MCP_PREPARE_PER_MINUTE = "120";
});
beforeEach(async () => { await policy(); remote.configured = true; remote.submit.mockReset().mockImplementation(async () => "fixture-" + randomUUID()); vi.stubGlobal("fetch", vi.fn(async () => { throw Error("External network forbidden"); })); });
afterAll(async () => {
  await Promise.all(clients.map(c => c.close())); await prisma.$disconnect(); vi.unstubAllGlobals();
  if (previous === undefined) delete process.env.ENGUI_MCP_POLICY_PATH; else process.env.ENGUI_MCP_POLICY_PATH = previous;
  await fs.rm(directory, { recursive: true, force: true });
});
async function fixture() {
  const ws = await prisma.workspace.create({ data: { id: randomUUID(), userId: "user-with-settings", name: "policy-test-" + randomUUID() } });
  const credential = await provisionCredential(ws.id, ["read", "generate", "curate", "cancel"], 1);
  const client = new Client({ name: "policy-test", version: "1" }); clients.push(client);
  await client.connect(new StreamableHTTPClientTransport(new URL("http://localhost/api/mcp"), { requestInit: { headers: { Authorization: "Bearer " + credential.token, "X-Workspace-Id": ws.id } }, fetch: async (i: any, n: any) => handleMcpRequest(new Request(i, n)) }));
  const call = async (name: string, args: any = {}) => {
    const r = await client.callTool({ name, arguments: args });
    if (r.isError) throw Object.assign(Error((r.content as any)[0].text), JSON.parse((r.content as any)[0].text));
    return (r.structuredContent as any).result;
  };
  const create = (name = "Fixture style") => call("engui_create_vibe", { name, baseDescription: "Warm cinematic lighting.", requestKey: randomUUID() });
  const plan = (extra: any = {}) => call("engui_prepare_generation", { modelId: "krea2-turbo", mode: "text_to_image", prompt: "A blue square.", width: 512, height: 512, variantCount: 1, seeds: [42], requestKey: randomUUID(), ...extra });
  const start = (p: any, key = randomUUID()) => call("engui_start_generation", { planId: p.planId, planDigest: p.planDigest, requestKey: key });
  return { ws, client, call, create, plan, start };
}
it("reports owner approval separately from configured and unknown runtime health", async () => {
  const f = await fixture(), models = (await f.call("engui_list_models")).models;
  expect(models.filter((m: any) => m.available).map((m: any) => m.id).sort()).toEqual([...allowed].sort());
  for (const m of models) { expect(m.configured).toBe(true); expect(m.health).toBe(null); expect(m.enabledByOwner).toBe(allowed.includes(m.id)); if (!m.available) expect(m.availabilityReason).toContain("owner"); }
  expect(remote.submit).not.toHaveBeenCalled();
});
it("does not equate owner approval with configuration or inferred GPU readiness", async () => {
  const f = await fixture(); remote.configured = false;
  const model = (await f.call("engui_list_models")).models.find((m: any) => m.id === "krea2-turbo");
  expect(model).toMatchObject({ enabledByOwner: true, available: false, configured: false, health: null });
  expect(model.availabilityReason).toContain("not configured");
  await expect(f.plan()).rejects.toMatchObject({ code: "MODEL_NOT_CONFIGURED" });
});
it.each(allowed)("still prepares and dispatches approved %s with a fake provider", async modelId => {
  const f = await fixture(), p = await f.plan({ modelId }), b = await f.start(p);
  await processMcpWorkspace(f.ws.id); expect(remote.submit).toHaveBeenCalledOnce();
  expect((await f.call("engui_get_batch", { batchId: b.batchId })).variants[0].providerAccepted).toBe(true);
});
it.each(["qwen-image-edit", "qwen-image-edit-maskflow"])("rejects disabled %s before any plan, media lookup or paid start", async modelId => {
  const f = await fixture();
  await expect(f.plan({ modelId, mode: modelId.endsWith("maskflow") ? "masked_image_edit" : "image_edit" })).rejects.toMatchObject({ code: "MODEL_UNAVAILABLE" });
  expect(await scope(f.ws.id, () => prisma.mcpGenerationPlan.count({ where: { workspaceId: f.ws.id } }))).toBe(0);
  expect(remote.submit).not.toHaveBeenCalled();
});
it("rejects disabled preparation replay and unstarted plans without rewriting history", async () => {
  const f = await fixture(), key = randomUUID(), p = await f.plan({ requestKey: key }); await policy([]);
  await expect(f.plan({ requestKey: key })).rejects.toMatchObject({ code: "MODEL_UNAVAILABLE" });
  await expect(f.start(p)).rejects.toMatchObject({ code: "MODEL_UNAVAILABLE" });
  expect((await f.call("engui_get_plan", { planId: p.planId })).snapshot).toEqual(p.snapshot);
  expect(await scope(f.ws.id, () => prisma.mcpGenerationBatch.count({ where: { workspaceId: f.ws.id } }))).toBe(0);
  expect(remote.submit).not.toHaveBeenCalled();
});
it("fences an already queued batch if the owner disables its model", async () => {
  const f = await fixture(), p = await f.plan(), b = await f.start(p); await policy([]);
  await processMcpWorkspace(f.ws.id);
  const status = await f.call("engui_get_batch", { batchId: b.batchId });
  expect(status.isTerminal).toBe(true); expect(status.variants[0].errorCode).toBe("MODEL_UNAVAILABLE"); expect(remote.submit).not.toHaveBeenCalled();
});
it("rechecks approval at the final provider boundary after local preparation", async () => {
  const f = await fixture(), p = await f.plan(), b = await f.start(p);
  const submit = providerAdapter.submit;
  vi.spyOn(providerAdapter, "submit").mockImplementationOnce(async (form, options) => submit(form, {
    ...options, beforeProviderSubmit: async evidence => { await policy([]); await options.beforeProviderSubmit(evidence); },
  }));
  await processMcpWorkspace(f.ws.id);
  expect((await f.call("engui_get_batch", { batchId: b.batchId })).variants[0].errorCode).toBe("MODEL_UNAVAILABLE");
  expect(remote.submit).not.toHaveBeenCalled();
});
it("keeps accepted work and start receipts readable without resubmitting after disable", async () => {
  const f = await fixture(), p = await f.plan(), key = randomUUID(), b = await f.start(p, key);
  await processMcpWorkspace(f.ws.id); await policy([]); await processMcpWorkspace(f.ws.id);
  expect((await f.start(p, key)).batchId).toBe(b.batchId);
  expect((await f.start(p)).batchId).toBe(b.batchId);
  expect((await f.call("engui_get_batch", { batchId: b.batchId })).variants[0].providerAccepted).toBe(true);
  expect(remote.submit).toHaveBeenCalledOnce();
});
it.each(["missing", "invalid", "unknown-key"])("fails closed on %s operator policy", async mode => {
  const f = await fixture();
  if (mode === "missing") await fs.unlink(filename);
  else await fs.writeFile(filename, mode === "invalid" ? "bad-json" : '{"enabledModels":["krea2-turbo"],"automaticEnable":true}');
  await expect(f.call("engui_list_models")).rejects.toMatchObject({ code: "MODEL_POLICY_UNAVAILABLE" });
  await expect(f.plan()).rejects.toMatchObject({ code: "MODEL_POLICY_UNAVAILABLE" }); expect(remote.submit).not.toHaveBeenCalled();
});
it("safe missing-default policy approves only the owner's two models and no preferences", async () => {
  delete process.env.ENGUI_MCP_POLICY_PATH;
  const spy = vi.spyOn(os, "homedir").mockReturnValue(directory);
  try { expect(await readOperatorPolicy()).toEqual({ enabledModels: ["z-image", "krea2-turbo"], workspacePreferences: {} }); }
  finally { spy.mockRestore(); process.env.ENGUI_MCP_POLICY_PATH = filename; }
});
it("marks only the designated workspace Vibe in both discovery tools and detail", async () => {
  const f = await fixture(), other = await fixture(), v = await f.create(), second = await f.create("Not preferred"), foreign = await other.create();
  await policy(allowed, { [f.ws.id]: { preferredVibeId: v.id } });
  for (const name of ["engui_list_vibes", "engui_list_presets"]) {
    const args = name.endsWith("presets") ? { kind: "vibes" } : {};
    const list = await f.call(name, args); expect(list.items.find((x: any) => x.id === v.id).preferred).toBe(true);
    expect(list.items.find((x: any) => x.id === second.id)).not.toHaveProperty("preferred");
    expect((await other.call(name, args)).items.every((x: any) => !("preferred" in x))).toBe(true);
  }
  const detail = await f.call("engui_get_vibe", { vibeId: v.id }); expect(detail.preferred).toBe(true); expect(detail.editRevision).toBe(v.editRevision);
  expect(await other.call("engui_get_vibe", { vibeId: foreign.id })).not.toHaveProperty("preferred");
  await expect(other.call("engui_get_vibe", { vibeId: v.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
});
it("omits recommendations for missing/foreign Vibes and does not choose a fallback", async () => {
  const f = await fixture(), other = await fixture(), v = await f.create(); await other.create();
  await policy(allowed, { [other.ws.id]: { preferredVibeId: v.id }, [f.ws.id]: { preferredVibeId: randomUUID() } });
  for (const x of [f, other]) expect((await x.call("engui_list_vibes")).items.every((v: any) => !("preferred" in v))).toBe(true);
});
it("hides preferred marker in trash and restores it only for the same Vibe", async () => {
  const f = await fixture(), v = await f.create(); await policy(allowed, { [f.ws.id]: { preferredVibeId: v.id } });
  const trash = await f.call("engui_delete_vibe", { vibeId: v.id, expectedRevision: v.editRevision, requestKey: randomUUID() });
  expect((await f.call("engui_list_vibes", { status: "trash" })).items[0]).not.toHaveProperty("preferred");
  expect(await f.call("engui_get_vibe", { vibeId: v.id })).not.toHaveProperty("preferred");
  await f.call("engui_restore_vibe", { vibeId: v.id, expectedRevision: trash.editRevision, requestKey: randomUUID() });
  expect((await f.call("engui_list_vibes")).items[0].preferred).toBe(true);
});
it("never applies preferred Vibe implicitly and leaves frozen plans valid after recommendation changes", async () => {
  const f = await fixture(), v = await f.create(); await policy(allowed, { [f.ws.id]: { preferredVibeId: v.id } });
  const plain = await f.plan(); expect(plain.snapshot.variants[0].prompt).toBe("A blue square."); expect(plain.snapshot.vibe).toBe(null);
  const explicit = await f.plan({ vibeId: v.id }); expect(explicit.snapshot.variants[0].prompt).toBe("Warm cinematic lighting.\n\nA blue square.");
  await policy(); await f.start(explicit); await processMcpWorkspace(f.ws.id); expect(remote.submit).toHaveBeenCalledOnce();
});
it("does not allow MCP callers to modify operator approval or preferences", async () => {
  const f = await fixture(), v = await f.create();
  await expect(f.plan({ enabledByOwner: true })).rejects.toThrow();
  await expect(f.call("engui_update_vibe", { vibeId: v.id, expectedRevision: v.editRevision, changes: { preferred: true }, requestKey: randomUUID() })).rejects.toThrow();
  expect((await f.client.listTools()).tools.some(t => /policy|enable_model|set_preferred/.test(t.name))).toBe(false);
  expect(await readOperatorPolicy()).toEqual({ enabledModels: allowed, workspacePreferences: {} });
});
