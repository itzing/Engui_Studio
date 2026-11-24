import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const provider = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock("@/lib/runpodService", () => ({ default: class { submitJob(...args: any[]) { return provider.submit(...args); } } }));
vi.mock("@/lib/settingsService", () => ({ default: class { async getSettings() { return { settings: {
  runpod: { apiKey: "fixture", fieldEncKeyB64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", endpoints: { "krea2-turbo": "fixture-krea" } },
  s3: { endpointUrl: "https://fixture.invalid", accessKeyId: "fixture", secretAccessKey: "fixture", bucketName: "fixture" },
} }; } } }));
vi.mock("@/lib/runpodSupervisor", () => ({ startRunPodSupervisor: vi.fn() }));
vi.mock("@/lib/galleryEnrichment", () => ({ queueGalleryEnrichment: vi.fn() }));
vi.mock("@/lib/galleryDerivatives", () => ({ queueGalleryDerivatives: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { workspaceContext } from "@/lib/workspaces/context";
import { provisionCredential } from "@/lib/mcp/auth";
import { handleMcpRequest } from "@/lib/mcp/server";
import { digest } from "@/lib/mcp/core";
import { characterSnapshot } from "@/lib/mcp/catalog";
import { processMcpWorkspace } from "@/lib/mcp/worker";
import { decryptStructuredEnvelope } from "@/lib/secureTransport";
const scope = <T>(workspaceId: string, work: () => T) => workspaceContext.run({ kind: "workspace", workspaceId }, async () => await work());
const clients: Client[] = [];
beforeAll(() => {
  if (!process.env.ENGUI_DATABASE_URL?.includes("engui-602-mcp-test")) throw Error("An isolated ENGUI-602 database is required");
  process.env.ENGUI_MCP_ENABLED = "1";
  process.env.ENGUI_MCP_PREPARE_PER_MINUTE = "120";
});
beforeEach(() => {
  provider.submit.mockReset().mockResolvedValue("fixture-remote");
  vi.stubGlobal("fetch", vi.fn(async () => { throw Error("External network is forbidden in MCP Character tests"); }));
});
afterAll(async () => { await Promise.all(clients.map(c => c.close())); vi.unstubAllGlobals(); await prisma.$disconnect(); });
async function fixture(scopes = ["read", "generate", "curate", "cancel"]) {
  const ws = await prisma.workspace.create({ data: { id: randomUUID(), userId: "user-with-settings", name: "MCP tags fixture " + randomUUID() } });
  const character = await scope(ws.id, () => prisma.character.create({ data: { workspaceId: ws.id, name: "Alice", gender: "female", traits: JSON.stringify({ hair_color: "copper" }) } }));
  const outfit = await scope(ws.id, () => prisma.outfit.create({ data: { workspaceId: ws.id, ownerCharacterId: character.id, name: "Coat", description: "blue velvet coat" } }));
  await scope(ws.id, () => prisma.character.update({ where: { id: character.id }, data: { defaultOutfitId: outfit.id } }));
  const token = await provisionCredential(ws.id, scopes, 1);
  const client = new Client({ name: "mcp-character-test", version: "1" }); clients.push(client);
  await client.connect(new StreamableHTTPClientTransport(new URL("http://localhost/api/mcp"), {
    requestInit: { headers: { Authorization: "Bearer " + token.token, "X-Workspace-Id": ws.id } },
    fetch: async (input: any, init: any) => handleMcpRequest(new Request(input, init)),
  }));
  // Real clients discover tools first and then validate every structured result.
  await client.listTools();
  const call = async (name: string, args: any = {}) => {
    const r = await client.callTool({ name, arguments: args });
    if (r.isError) { const e = JSON.parse((r.content as any)[0].text); throw Object.assign(Error(e.message), { code: e.code }); }
    return (r.structuredContent as any).result;
  };
  const tag = (withOutfit = false) => `{character:${character.id}${withOutfit ? ":withOutfit" : ""}}`;
  const plan = (extra: any = {}) => call("engui_prepare_generation", { mode: "text_to_image", modelId: "krea2-turbo", prompt: tag(), requestKey: randomUUID(), seeds: [11, 22, 33], ...extra });
  const start = (p: any) => call("engui_start_generation", { planId: p.planId, planDigest: p.planDigest, requestKey: randomUUID() });
  return { ws, character, outfit, client, call, tag, plan, start };
}
async function second(f: Awaited<ReturnType<typeof fixture>>) {
  return scope(f.ws.id, () => prisma.character.create({ data: { workspaceId: f.ws.id, name: "Rival", gender: "male", traits: JSON.stringify({ hair_color: "silver" }) } }));
}
describe("MCP Character reference plans", () => {
  it("advertises startup instructions, equivalent guide tool/resource and prompt schema", async () => {
    const f = await fixture(["read"]);
    expect(f.client.getInstructions()).toContain("engui_get_prompt_guide");
    const tools = (await f.client.listTools()).tools;
    expect(tools).toHaveLength(16);
    expect(tools.map(t => t.name)).toContain("engui_list_wildcards");
    const guide = await f.call("engui_get_prompt_guide");
    expect(guide.markdown).toContain("{character:UUID:withOutfit}");
    expect(guide.markdown).toContain("wildcardReplacements");
    const r = await f.client.readResource({ uri: guide.uri });
    expect("text" in r.contents[0] ? r.contents[0].text : null).toBe(guide.markdown);
    await expect(f.plan()).rejects.toThrow();
  });
  it("has no primary Character selectors in discovery and rejects them instead of ignoring them", async () => {
    const f = await fixture();
    const t = (await f.client.listTools()).tools.find(t => t.name === "engui_prepare_generation")!;
    for (const key of ["characterId", "characterVersionId", "outfitId"]) {
      expect(t.inputSchema.properties).not.toHaveProperty(key);
      expect(t.inputSchema.required || []).not.toContain(key);
      await expect(f.plan({ [key]: f.character.id })).rejects.toThrow();
    }
    expect(await scope(f.ws.id, () => prisma.mcpGenerationPlan.count())).toBe(0);
    expect(provider.submit).not.toHaveBeenCalled();
  });
  it("prepares and submits unchanged plain text in a workspace with zero Characters", async () => {
    const f = await fixture();
    await scope(f.ws.id, () => prisma.character.delete({ where: { id: f.character.id } }));
    expect(await scope(f.ws.id, () => prisma.character.count())).toBe(0);
    const prompt = "Wide cinematic 16:9 empty city.\n\nRain falls on the pavement.";
    const p = await f.plan({ prompt, variantCount: 1, seeds: [42] });
    expect(p.snapshot.schemaVersion).toBe(2);
    expect(p.snapshot).not.toHaveProperty("character");
    expect(p.snapshot).not.toHaveProperty("characterDigest");
    expect(p.snapshot.characterReferences).toEqual([]);
    expect(p.snapshot.stages.characterMode).toBe("plain");
    expect(p.snapshot.variants[0].prompt).toBe(prompt);
    await f.start(p); await processMcpWorkspace(f.ws.id);
    expect(provider.submit).toHaveBeenCalledOnce();
    const input = provider.submit.mock.calls[0][0];
    const sent = decryptStructuredEnvelope<any>(Buffer.alloc(32), input._secure, input._secure.binding);
    expect(sent.prompt).toBe(prompt);
    expect((await scope(f.ws.id, () => prisma.job.findFirstOrThrow())).prompt).toBe(prompt);
  }, 15000);
  it("unrelated Character/outfit edits do not invalidate plain plans or enter their text", async () => {
    const f = await fixture(), prompt = "A quiet courtyard", p = await f.plan({ prompt });
    await scope(f.ws.id, () => prisma.character.update({ where: { id: f.character.id }, data: { traits: JSON.stringify({ hair_color: "green" }), deletedAt: new Date() } }));
    await scope(f.ws.id, () => prisma.outfit.update({ where: { id: f.outfit.id }, data: { description: "red coat", revision: { increment: 1 } } }));
    expect(p.snapshot.variants.every((v: any) => v.prompt === prompt)).toBe(true);
    expect((await f.start(p)).accepted).toBe(true);
  });
  it("applies framing and view only when explicitly requested", async () => {
    const f = await fixture(), p = await f.plan({ prompt: "A courier", framing: "portrait", view: "side" });
    expect(p.snapshot.variants[0].prompt).toContain("Side view.");
    expect(p.snapshot.variants[0].prompt).not.toContain("copper");
    expect(p.snapshot.variants[0].prompt).not.toContain("blue velvet coat");
    expect(p.snapshot.variants[0].prompt.endsWith("A courier")).toBe(true);
  });
  it("lists only active workspace wildcards with pagination/query and no default writes", async () => {
    const f = await fixture(["read"]), other = await fixture();
    const initial = await scope(f.ws.id, () => prisma.promptWildcard.count());
    expect((await f.call("engui_list_wildcards")).items).toEqual([]);
    expect(await scope(f.ws.id, () => prisma.promptWildcard.count())).toBe(initial);
    await scope(f.ws.id, () => prisma.promptWildcard.createMany({ data: [
      { workspaceId: f.ws.id, key: "lighting", name: "Light", value: "{red|blue}" },
      { workspaceId: f.ws.id, key: "scene", name: "Scene", value: "courtyard" },
      { workspaceId: f.ws.id, key: "deleted", name: "Deleted", value: "secret", status: "trash" },
    ] }));
    await scope(other.ws.id, () => prisma.promptWildcard.create({ data: { workspaceId: other.ws.id, key: "foreign", name: "Foreign", value: "hidden" } }));
    const a = await f.call("engui_list_wildcards", { limit: 1 });
    const b = await f.call("engui_list_wildcards", { limit: 1, cursor: a.nextCursor });
    expect(new Set([...a.items, ...b.items].map((x: any) => x.key))).toEqual(new Set(["lighting", "scene"]));
    expect(b.nextCursor).toBeNull();
    expect((await f.call("engui_list_wildcards", { query: "lighting" })).items[0].value).toBe("{red|blue}");
  });
  it.each([false, true])("renders current identity withOutfit=%s exactly once, including portrait", async withOutfit => {
    const f = await fixture(), p = await f.plan({ prompt: f.tag(withOutfit) + " looks at camera", framing: "portrait" });
    expect(p.snapshot.stages.characterMode).toBe("inline");
    expect(p.snapshot.characterReferences).toHaveLength(1);
    const ref = p.snapshot.characterReferences[0];
    expect(ref).toMatchObject({ characterId: f.character.id, includeOutfit: withOutfit, outfitId: withOutfit ? f.outfit.id : null });
    for (const v of p.snapshot.variants) {
      expect(v.prompt).not.toContain("{character:");
      expect(v.prompt.split(ref.text)).toHaveLength(2);
      expect(v.prompt.includes("blue velvet coat")).toBe(withOutfit);
      expect(v.characterReferences).toEqual([ref]);
    }
    expect(p.snapshot.draft.prompt).toContain(f.tag(withOutfit));
    expect(p.snapshot.stages.wildcardReplacements).toEqual([]);
  });
  it("allows identity-only with an archived default but rejects withOutfit clearly", async () => {
    const f = await fixture();
    await scope(f.ws.id, () => prisma.outfit.update({ where: { id: f.outfit.id }, data: { deletedAt: new Date() } }));
    expect((await f.plan()).snapshot.variants[0].prompt).toContain("copper");
    await expect(f.plan({ prompt: f.tag(true) })).rejects.toMatchObject({ code: "INVALID_CHARACTER_REFERENCE" });
  });
  it("does not add an untagged primary character and shares snapshots for repeated tags", async () => {
    const f = await fixture(), rival = await second(f), token = `{character:${rival.id}}`;
    const p = await f.plan({ prompt: `${token} in foreground. A reflection of ${token}.` });
    expect(p.snapshot.characterReferences).toHaveLength(1);
    expect(p.snapshot.variants[0].prompt).not.toContain("copper");
    expect(p.snapshot.variants[0].prompt.split(p.snapshot.characterReferences[0].text)).toHaveLength(3);
  });
  it("protects tags in seeded choices and keeps appearance braces/dollars literal", async () => {
    const f = await fixture(), rival = await second(f);
    await scope(f.ws.id, () => prisma.character.update({ where: { id: rival.id }, data: { traits: JSON.stringify({ hair_color: "$& {silver|gold}" }) } }));
    const prompt = `{${f.tag()}|{character:${rival.id}}} with {red|blue} lighting`;
    const a = await f.plan({ prompt }), b = await f.plan({ prompt });
    expect(a.snapshot.variants).toEqual(b.snapshot.variants);
    expect(a.snapshot.characterReferences).toHaveLength(2);
    const literal = await f.plan({ prompt: `{character:${rival.id}}` });
    expect(literal.snapshot.variants[0].prompt).toContain("$& {silver|gold}");
    for (const v of a.snapshot.variants) {
      expect(v.characterReferences).toHaveLength(1);
      expect(v.prompt).not.toContain("{character:");
      if (v.characterReferences[0].characterId === rival.id) expect(v.prompt).toContain("$& {silver|gold}");
    }
  });
  it("expands tags introduced by wildcards and Vibes without implicit identity", async () => {
    const f = await fixture(), rival = await second(f);
    const vibe = await scope(f.ws.id, () => prisma.vibePreset.create({ data: { workspaceId: f.ws.id, name: "Scene", baseDescription: "Background witness {character:" + rival.id + "}." } }));
    await scope(f.ws.id, () => prisma.promptWildcard.create({ data: { workspaceId: f.ws.id, key: "lead", name: "Lead", value: f.tag(true) } }));
    const p = await f.plan({ prompt: "{lead} in rain", vibeId: vibe.id });
    expect(p.snapshot.characterReferences).toHaveLength(2);
    expect(p.snapshot.stages.wildcardReplacements).toHaveLength(1);
    expect(p.snapshot.variants[0].prompt.split("copper")).toHaveLength(2);
    expect(p.snapshot.variants[0].prompt).toContain("silver");
    expect(p.snapshot.variants[0].prompt).not.toContain("{character:");
  });
  it.each(["{character:bad}", "{character:", "{character:00000000-0000-0000-0000-000000000000}"])("rejects invalid reference %s before plan creation", async prompt => {
    const f = await fixture();
    await expect(f.plan({ prompt })).rejects.toMatchObject({ code: "INVALID_CHARACTER_REFERENCE" });
    expect(await scope(f.ws.id, () => prisma.mcpGenerationPlan.count())).toBe(0);
    expect(provider.submit).not.toHaveBeenCalled();
  });
  it("rejects foreign/deleted characters and a missing requested default outfit", async () => {
    const f = await fixture(), other = await fixture(), rival = await second(f);
    await expect(f.plan({ prompt: other.tag() })).rejects.toMatchObject({ code: "INVALID_CHARACTER_REFERENCE" });
    await expect(f.plan({ prompt: `{character:${rival.id}:withOutfit}` })).rejects.toThrow("No default outfit");
    await scope(f.ws.id, () => prisma.character.update({ where: { id: rival.id }, data: { deletedAt: new Date() } }));
    await expect(f.plan({ prompt: `{character:${rival.id}}` })).rejects.toMatchObject({ code: "INVALID_CHARACTER_REFERENCE" });
  });
  it.each(["character", "outfit", "version", "negative"])("rejects contradictory %s options explicitly", async kind => {
    const f = await fixture();
    const extra = kind === "character" ? { characterId: f.character.id } : kind === "outfit" ? { outfitId: f.outfit.id } : kind === "negative" ? { negativePrompt: f.tag() } : { characterVersionId: f.character.currentVersionId || randomUUID() };
    await expect(f.plan(extra)).rejects.toThrow();
    expect(await scope(f.ws.id, () => prisma.mcpGenerationPlan.count())).toBe(0);
  });
  it("invalidates changed secondary identity/outfit and preserves old snapshots", async () => {
    const f = await fixture(), rival = await second(f);
    const outfit = await scope(f.ws.id, () => prisma.outfit.create({ data: { workspaceId: f.ws.id, ownerCharacterId: rival.id, name: "Rival coat", description: "scarlet coat" } }));
    await scope(f.ws.id, () => prisma.character.update({ where: { id: rival.id }, data: { defaultOutfitId: outfit.id } }));
    const prompt = f.tag() + ` faces {character:${rival.id}:withOutfit}`;
    const old = await f.plan({ prompt });
    await scope(f.ws.id, () => prisma.outfit.update({ where: { id: outfit.id }, data: { description: "emerald coat", revision: { increment: 1 } } }));
    await expect(f.start(old)).rejects.toMatchObject({ code: "PLAN_STALE" });
    expect((await f.call("engui_get_plan", { planId: old.planId })).snapshot).toEqual(old.snapshot);
    const fresh = await f.plan({ prompt });
    expect(fresh.snapshot.variants[0].prompt).toContain("emerald coat");
    await scope(f.ws.id, () => prisma.character.update({ where: { id: rival.id }, data: { traits: JSON.stringify({ hair_color: "violet" }) } }));
    await expect(f.start(fresh)).rejects.toMatchObject({ code: "PLAN_STALE" });
    const deleted = await f.plan({ prompt });
    await scope(f.ws.id, () => prisma.character.update({ where: { id: rival.id }, data: { deletedAt: new Date() } }));
    await expect(f.start(deleted)).rejects.toMatchObject({ code: "PLAN_STALE" });
  });
  it("keeps legacy untagged plans usable but blocks unresolved-tag plans without rewriting them", async () => {
    const f = await fixture();
    for (const unresolved of [false, true]) {
      const p = await f.plan({ prompt: "A quiet courtyard" });
      const c = await scope(f.ws.id, () => characterSnapshot(f.character.id));
      p.snapshot.schemaVersion = 1;
      p.snapshot.draft.characterId = f.character.id;
      p.snapshot.character = c.snapshot;
      p.snapshot.characterDigest = c.digest;
      p.snapshot.stages.characterMode = "structured";
      delete p.snapshot.characterReferences;
      if (unresolved) p.snapshot.variants[0].prompt += " " + f.tag();
      p.planDigest = digest(p.snapshot);
      await scope(f.ws.id, () => prisma.mcpGenerationPlan.update({ where: { id: p.planId }, data: { snapshotJson: JSON.stringify(p.snapshot), digest: p.planDigest } }));
      if (unresolved) await expect(f.start(p)).rejects.toMatchObject({ code: "PLAN_STALE" });
      else expect((await f.start(p)).accepted).toBe(true);
      expect((await f.call("engui_get_plan", { planId: p.planId })).snapshot).toEqual(p.snapshot);
    }
  });
  it("retains Character freshness for real legacy structured plans and approved references", async () => {
    const f = await fixture(), p = await f.plan({ prompt: "Legacy already-composed text", variantCount: 1, seeds: [42] });
    const c = await scope(f.ws.id, () => characterSnapshot(f.character.id));
    p.snapshot.schemaVersion = 1;
    Object.assign(p.snapshot, { character: c.snapshot, characterDigest: c.digest });
    p.snapshot.draft.characterId = f.character.id;
    p.snapshot.stages.characterMode = "structured";
    p.planDigest = digest(p.snapshot);
    await scope(f.ws.id, async () => {
      await prisma.mcpGenerationPlan.update({ where: { id: p.planId }, data: { snapshotJson: JSON.stringify(p.snapshot), digest: p.planDigest } });
      await prisma.characterConceptReference.create({ data: { workspaceId: f.ws.id, characterId: f.character.id, revision: 1, snapshotJson: JSON.stringify(p.snapshot) } });
    });
    expect((await f.call("engui_get_concept_reference", { characterId: f.character.id })).reference.stale).toBe(false);
    await scope(f.ws.id, () => prisma.character.update({ where: { id: f.character.id }, data: { traits: JSON.stringify({ hair_color: "new legacy identity" }) } }));
    await expect(f.start(p)).rejects.toMatchObject({ code: "PLAN_STALE" });
    expect((await f.call("engui_get_concept_reference", { characterId: f.character.id })).reference.stale).toBe(true);
    expect((await f.call("engui_get_plan", { planId: p.planId })).snapshot).toEqual(p.snapshot);
  });
  it("submits exactly the frozen resolved prompt through encrypted provider transport", async () => {
    const f = await fixture(), p = await f.plan({ prompt: f.tag(true) + " in rain", variantCount: 1, seeds: [42] });
    await f.start(p);
    await processMcpWorkspace(f.ws.id);
    expect(provider.submit).toHaveBeenCalledOnce();
    const input = provider.submit.mock.calls[0][0] as any;
    const sent = decryptStructuredEnvelope<any>(Buffer.alloc(32), input._secure, input._secure.binding);
    expect(sent.prompt).toBe(p.snapshot.variants[0].prompt);
    expect(sent.prompt).not.toContain("{character:");
    const job = await scope(f.ws.id, () => prisma.job.findFirstOrThrow());
    expect(job.prompt).toBe(p.snapshot.variants[0].prompt);
  });
});
