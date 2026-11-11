import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
vi.mock("@/lib/settingsService", () => ({
  default: class {
    async getSettings() {
      return {
        settings: {
          runpod: {
            apiKey: "fixture",
            fieldEncKeyB64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
            endpoints: {
              "krea2-turbo": "fixture-krea",
              "z-image": "fixture-z",
              "qwen-image-edit": "fixture-qwen",
            },
          },
          s3: {
            endpointUrl: "https://fixture.invalid",
            accessKeyId: "fixture",
            secretAccessKey: "fixture",
            bucketName: "fixture",
          },
        },
      };
    }
  },
}));
vi.mock("@/lib/runpodSupervisor", () => ({ startRunPodSupervisor: vi.fn() }));
vi.mock("@/lib/galleryEnrichment", () => ({ queueGalleryEnrichment: vi.fn() }));
vi.mock("@/lib/galleryDerivatives", () => ({
  queueGalleryDerivatives: vi.fn(),
}));
import { prisma } from "@/lib/prisma";
import { workspaceContext } from "@/lib/workspaces/context";
import { provisionCredential, authenticate } from "@/lib/mcp/auth";
import { handleMcpRequest } from "@/lib/mcp/server";
import { draftSchema, inputSchemas } from "@/lib/mcp/core";
import { effectiveSettings } from "@/lib/mcp/catalog";
import { processMcpWorkspace, providerAdapter } from "@/lib/mcp/worker";
import RunPodService from "@/lib/runpodService";
import { submitPreparedGeneration } from "@/lib/generation/submitFormData";
import { batchState } from "@/lib/mcp/batches";
const directories: string[] = [];
let bytes: Buffer;
const scope = <T>(id: string, work: () => T) =>
  workspaceContext.run({ kind: "workspace", workspaceId: id }, work);
async function fixture(scopes = ["read", "generate", "curate", "cancel"]) {
  const ws = await prisma.workspace.create({
    data: {
      id: randomUUID(),
      userId: "user-with-settings",
      name: randomUUID(),
    },
  });
  directories.push(path.join(process.cwd(), "public", "generations", "gallery", ws.id));
  const character = await scope(ws.id, () =>
    prisma.character.create({
      data: {
        workspaceId: ws.id,
        name: "Fighter",
        gender: "male",
        traits: JSON.stringify({ height: "tall", hair: "black hair" }),
        editorState: "{}",
      },
    }),
  );
  const credential = await provisionCredential(ws.id, scopes, 1);
  const headers = {
    Authorization: "Bearer " + credential.token,
    "X-Workspace-Id": ws.id,
  };
  const client = new Client({ name: "isolated-test-client", version: "1.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL("http://localhost/api/mcp"), {
      requestInit: { headers },
      fetch: async (input: any, init: any) =>
        handleMcpRequest(new Request(input, init)),
    }),
  );
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    if (result.isError) {
      const error = JSON.parse((result.content as any)[0].text);
      throw Object.assign(Error(error.message), { code: error.code });
    }
    return (result.structuredContent as any)?.result;
  };
  return { ws, character, credential, headers, client, call };
}
async function plan(f: Awaited<ReturnType<typeof fixture>>, extra: any = {}) {
  return f.call("engui_prepare_generation", {
    characterId: f.character.id,
    modelId: "krea2-turbo",
    mode: "text_to_image",
    prompt: "Fighting game concept. {red|blue} jacket.",
    requestKey: randomUUID(),
    ...extra,
  });
}
async function start(f: any, p: any, key = randomUUID()) {
  return f.call("engui_start_generation", {
    planId: p.planId,
    planDigest: p.planDigest,
    requestKey: key,
  });
}
async function imageAsset(ws: string, extra: any = {}) {
  const dirname = path.join(
    process.cwd(),
    "public",
    "generations",
    "mcp-tests-" + ws,
  );
  directories.push(dirname);
  await fs.mkdir(dirname, { recursive: true });
  await fs.writeFile(path.join(dirname, "fixture.png"), bytes);
  return scope(ws, () =>
    prisma.galleryAsset.create({
      data: {
        workspaceId: ws,
        type: "image",
        bucket: "draft",
        contentHash: createHash("sha256").update(bytes).digest("hex"),
        originalUrl: `/generations/mcp-tests-${ws}/fixture.png`,
        ...extra,
      },
    }),
  );
}
beforeAll(async () => {
  if (!process.env.ENGUI_DATABASE_URL?.includes("mcp-test"))
    throw Error("Refusing non-test database");
  process.env.ENGUI_MCP_ENABLED = "1";
  process.env.ENGUI_MCP_PREPARE_PER_MINUTE = "120";
  bytes = await sharp({
    create: { width: 64, height: 96, channels: 3, background: "#336699" },
  })
    .png()
    .toBuffer();
});
afterAll(async () => {
  await prisma.$disconnect();
  for (const d of new Set(directories))
    await fs.rm(d, { recursive: true, force: true });
});

describe("workspace-bound MCP integration", () => {
  it("official SDK initializes and discovers 15 strict typed tools without an agent connection", async () => {
    const f = await fixture();
    const list = await f.client.listTools();
    expect(list.tools).toHaveLength(15);
    expect(
      list.tools.every(
        (t) => t.inputSchema.additionalProperties === false && t.outputSchema,
      ),
    ).toBe(true);
    const c = await f.call("engui_get_context");
    expect(c.limits.maxVariants).toBe(3);
    expect(c.operations).toHaveLength(15);
    await f.client.close();
  });
  it("rejects invalid, missing, revoked and swapped-scope credentials and wrong hosts", async () => {
    const a = await fixture(),
      b = await fixture();
    for (const [headers, status] of [
      [{}, 401],
      [{ ...a.headers, "X-Workspace-Id": b.ws.id }, 403],
      [{ Authorization: a.headers.Authorization }, 400],
      [{ ...a.headers, "X-Workspace-Id": a.ws.id + ", " + b.ws.id }, 400],
    ] as const) {
      expect(
        (
          await handleMcpRequest(
            new Request("http://localhost/api/mcp", {
              method: "POST",
              headers,
            }),
          )
        ).status,
      ).toBe(status);
    }
    expect(
      (
        await handleMcpRequest(
          new Request("http://evil.invalid/api/mcp", {
            method: "POST",
            headers: a.headers,
          }),
        )
      ).status,
    ).toBe(403);
    await scope(a.ws.id, () =>
      prisma.mcpCredential.update({
        where: { id: a.credential.id },
        data: { revokedAt: new Date() },
      }),
    );
    expect(
      (
        await handleMcpRequest(
          new Request("http://localhost/api/mcp", {
            method: "POST",
            headers: a.headers,
          }),
        )
      ).status,
    ).toBe(401);
  });
  it("read-only discovery excludes mutations and direct calls cannot escalate", async () => {
    const f = await fixture(["read"]);
    expect((await f.client.listTools()).tools).toHaveLength(10);
    await expect(plan(f)).rejects.toThrow();
  });
  it("bounds requests, enforces strict nested inputs and rejects query selectors", async () => {
    const f = await fixture();
    expect(
      (
        await handleMcpRequest(
          new Request("http://localhost/api/mcp?workspaceId=" + f.ws.id, {
            headers: f.headers,
          }),
        )
      ).status,
    ).toBe(400);
    const resp = await handleMcpRequest(
      new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: {
          ...f.headers,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: " ".repeat(130 * 1024),
      }),
    );
    expect(resp.status).toBe(413);
    await expect(
      f.call("engui_get_character", {
        characterId: f.character.id,
        workspaceId: f.ws.id,
      }),
    ).rejects.toThrow();
    expect(() =>
      draftSchema.parse({
        characterId: f.character.id,
        modelId: "krea2-turbo",
        mode: "text_to_image",
        prompt: "x",
        requestKey: randomUUID(),
        parameters: { endpointId: "injected" },
      }),
    ).toThrow();
  });
  it("concurrent workspace reads and direct IDs stay isolated", async () => {
    const a = await fixture(),
      b = await fixture();
    const [x, y] = await Promise.all([
      a.call("engui_list_characters"),
      b.call("engui_list_characters"),
    ]);
    expect(x.items.map((c: any) => c.id)).toEqual([a.character.id]);
    expect(y.items.map((c: any) => c.id)).toEqual([b.character.id]);
    await expect(
      a.call("engui_get_character", { characterId: b.character.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const asset = await imageAsset(b.ws.id);
    await expect(
      a.call("engui_get_image", {
        source: { kind: "gallery_asset", assetId: asset.id },
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("returns real downscaled image bytes and rejects altered original hashes", async () => {
    const f = await fixture(),
      a = await imageAsset(f.ws.id);
    const result = await f.client.callTool({
      name: "engui_get_image",
      arguments: { source: { kind: "gallery_asset", assetId: a.id } },
    });
    expect(result.isError).not.toBe(true);
    const image = (result.content as any[]).find((c) => c.type === "image");
    expect(image.mimeType).toBe("image/webp");
    expect(
      (await sharp(Buffer.from(image.data, "base64")).metadata()).width,
    ).toBe(64);
    await scope(f.ws.id, () =>
      prisma.galleryAsset.update({
        where: { id: a.id },
        data: { contentHash: "bad" },
      }),
    );
    await expect(
      f.call("engui_get_image", {
        source: { kind: "gallery_asset", assetId: a.id },
      }),
    ).rejects.toMatchObject({ code: "MEDIA_UNAVAILABLE" });
  });
  it("prepares three frozen distinct variants, replays identically and rejects changed payload", async () => {
    const f = await fixture();
    const key = randomUUID();
    const [a, b] = await Promise.all([
      plan(f, { requestKey: key }),
      plan(f, { requestKey: key }),
    ]);
    expect(a.planId).toBe(b.planId);
    expect(new Set(a.snapshot.variants.map((v: any) => v.seed)).size).toBe(3);
    expect(
      a.snapshot.variants.every((v: any) => !v.prompt.includes("{red|blue}")),
    ).toBe(true);
    expect(await prisma.job.count({ where: { workspaceId: f.ws.id } })).toBe(0);
    await expect(
      plan(f, { requestKey: key, prompt: "changed" }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });
  it("validates model, parameter and reference capabilities before any provider work", () => {
    const base = {
      characterId: randomUUID(),
      prompt: "x",
      requestKey: randomUUID(),
      mode: "text_to_image",
      modelId: "krea2-turbo",
    };
    for (const change of [
      { mode: "image_edit" },
      { parameters: { denoise: 0.2 } },
      { width: 1023 },
      { seeds: [1, 1, 2] },
      { references: [{ kind: "gallery_asset", assetId: randomUUID() }] },
    ])
      expect(() =>
        effectiveSettings(draftSchema.parse({ ...base, ...change })),
      ).toThrow();
    expect(() =>
      effectiveSettings(
        draftSchema.parse({
          ...base,
          modelId: "z-image",
          mode: "image_to_image",
          references: [{ kind: "gallery_asset", assetId: randomUUID() }],
          parameters: { denoise: 0.3 },
        }),
      ),
    ).not.toThrow();
    expect(() =>
      effectiveSettings(
        draftSchema.parse({
          ...base,
          modelId: "qwen-image-edit",
          mode: "image_edit",
          references: [{ kind: "gallery_asset", assetId: randomUUID() }],
          parameters: { guidance: 2 },
        }),
      ),
    ).not.toThrow();
  });
  it("one plan yields one batch across concurrent keys and changed digest is rejected", async () => {
    const f = await fixture(),
      p = await plan(f),
      key = randomUUID();
    const [a, b, c] = await Promise.all([
      start(f, p, key),
      start(f, p, key),
      start(f, p),
    ]);
    expect(new Set([a.batchId, b.batchId, c.batchId]).size).toBe(1);
    expect(
      await prisma.mcpGenerationVariant.count({
        where: { workspaceId: f.ws.id },
      }),
    ).toBe(3);
    await expect(
      f.call("engui_start_generation", {
        planId: p.planId,
        planDigest: "a".repeat(64),
        requestKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "PLAN_STALE" });
  });
  it("stale and expired plans cannot start", async () => {
    const f = await fixture(),
      p = await plan(f);
    await scope(f.ws.id, () =>
      prisma.character.update({
        where: { id: f.character.id },
        data: { traits: JSON.stringify({ hair: "different" }) },
      }),
    );
    await expect(start(f, p)).rejects.toMatchObject({ code: "PLAN_STALE" });
    const fresh = await plan(f);
    await scope(f.ws.id, () =>
      prisma.mcpGenerationPlan.update({
        where: { id: fresh.planId },
        data: { expiresAt: new Date(0) },
      }),
    );
    await expect(start(f, fresh)).rejects.toMatchObject({
      code: "PLAN_EXPIRED",
    });
  });
  it("cancellation fences undispatched work and preserves a replayable receipt", async () => {
    const f = await fixture(),
      p = await plan(f),
      b = await start(f, p),
      key = randomUUID();
    const a = await f.call("engui_cancel_batch", {
      batchId: b.batchId,
      requestKey: key,
    });
    expect(
      await f.call("engui_cancel_batch", {
        batchId: b.batchId,
        requestKey: key,
      }),
    ).toEqual(a);
    expect(
      (await f.call("engui_get_batch", { batchId: b.batchId })).state,
    ).toBe("cancelled");
  });
  it("unknown provider acceptance blocks the remaining batch and is never retried", async () => {
    const f = await fixture(),
      p = await plan(f),
      b = await start(f, p);
    let calls = 0;
    const original = providerAdapter.submit;
    providerAdapter.submit = async (form, hooks) => {
      calls++;
      await prisma.job.create({
        data: {
          id: String(form.get("jobId")),
          workspaceId: f.ws.id,
          userId: "user-with-settings",
          type: "image",
          status: "queueing_up",
          modelId: "krea2-turbo",
        },
      });
      await hooks.beforeProviderSubmit({ endpointId: "fake", secureState: {} });
      throw Error("Lost acknowledgement");
    };
    try {
      await processMcpWorkspace(f.ws.id);
      await processMcpWorkspace(f.ws.id);
      expect(calls).toBe(1);
      expect(
        (await f.call("engui_get_batch", { batchId: b.batchId })).state,
      ).toBe("needs_attention");
      await start(f, p);
      await processMcpWorkspace(f.ws.id);
      expect(calls).toBe(1);
    } finally {
      providerAdapter.submit = original;
    }
  });
  it("expired dispatch lease after boundary becomes unknown, not queued", async () => {
    const f = await fixture(),
      p = await plan(f),
      b = await start(f, p);
    await scope(f.ws.id, () =>
      prisma.mcpGenerationVariant.update({
        where: { id: b.variants[0].variantId },
        data: {
          state: "submitting",
          boundaryAt: new Date(),
          leaseUntil: new Date(0),
        },
      }),
    );
    await processMcpWorkspace(f.ws.id);
    expect(
      (await f.call("engui_get_batch", { batchId: b.batchId })).state,
    ).toBe("needs_attention");
  });
  it("credential revocation before dispatch blocks all provider calls", async () => {
    const f = await fixture(),
      p = await plan(f),
      b = await start(f, p);
    await scope(f.ws.id, () =>
      prisma.mcpCredential.update({
        where: { id: f.credential.id },
        data: { revokedAt: new Date() },
      }),
    );
    await processMcpWorkspace(f.ws.id);
    const v = await scope(f.ws.id, () =>
      prisma.mcpGenerationVariant.findFirst({
        where: { id: b.variants[0].variantId },
      }),
    );
    expect(v?.state).toBe("failed");
    expect(v?.errorCode).toBe("WORKSPACE_UNAVAILABLE");
    expect(await prisma.job.count({ where: { workspaceId: f.ws.id } })).toBe(0);
  });
  it("saves originals idempotently and versions only explicit approval; edits make it stale", async () => {
    const f = await fixture(),
      asset = await imageAsset(f.ws.id);
    const source = { kind: "gallery_asset", assetId: asset.id };
    const key = randomUUID();
    const [a, b] = await Promise.all([
      f.call("engui_save_output", { source, requestKey: key }),
      f.call("engui_save_output", { source, requestKey: key }),
    ]);
    expect(a.assetId).toBe(b.assetId);
    const p = await plan(f, {
      modelId: "qwen-image-edit",
      mode: "image_edit",
      references: [source],
      variantCount: 1,
    });
    const review = {
      characterId: f.character.id,
      assetId: asset.id,
      snapshotPlanId: p.planId,
      expectedRevision: 0,
      decision: "approved",
      requestKey: randomUUID(),
    };
    const approved = await f.call("engui_record_concept_review", review);
    expect(approved.revision).toBe(1);
    expect(await f.call("engui_record_concept_review", review)).toEqual(
      approved,
    );
    await expect(
      f.call("engui_record_concept_review", {
        ...review,
        requestKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    expect(
      (
        await f.call("engui_get_concept_reference", {
          characterId: f.character.id,
        })
      ).reference.stale,
    ).toBe(false);
    await scope(f.ws.id, () =>
      prisma.character.update({
        where: { id: f.character.id },
        data: { traits: JSON.stringify({ hair: "changed" }) },
      }),
    );
    expect(
      (
        await f.call("engui_get_concept_reference", {
          characterId: f.character.id,
        })
      ).reference.stale,
    ).toBe(true);
  });

  it("shared submission preserves a frozen literal prompt and passes single-attempt policy", async () => {
    const f = await fixture();
    const jobId = randomUUID();
    const form = new FormData();
    for (const [k, v] of Object.entries({
      jobId,
      workspaceId: f.ws.id,
      modelId: "krea2-turbo",
      prompt: "literal {do|not|expand}",
      seed: "42",
      width: "1024",
      height: "1024",
      language: "en",
    }))
      form.set(k, v);
    const spy = vi
      .spyOn(RunPodService.prototype, "submitJob")
      .mockResolvedValue("mock-remote");
    const hooks = {
      prompt: "literal {do|not|expand}",
      metadata: { fixture: true },
      beforeProviderSubmit: vi.fn(async () => {}),
      afterProviderAccepted: vi.fn(async () => {}),
    };
    const response = await scope(f.ws.id, () =>
      submitPreparedGeneration(form, hooks),
    );
    expect(response.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][2]).toEqual({ noRetry: true });
    const job = await scope(f.ws.id, () =>
      prisma.job.findFirst({ where: { id: jobId } }),
    );
    expect(job?.prompt).toBe(hooks.prompt);
    expect(hooks.beforeProviderSubmit).toHaveBeenCalledOnce();
    expect(hooks.afterProviderAccepted).toHaveBeenCalledWith("mock-remote");
    spy.mockRestore();
  });
  it("provider noRetry policy makes one HTTP attempt after a lost acknowledgement", async () => {
    const fetcher = vi.fn().mockRejectedValue(Error("fetch failed"));
    vi.stubGlobal("fetch", fetcher);
    try {
      await expect(
        new RunPodService("fixture", "fixture-endpoint").submitJob(
          { prompt: "fixture" } as any,
          undefined,
          { noRetry: true },
        ),
      ).rejects.toThrow();
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("successful mock batch archives exact originals and approvals survive source-job cleanup", async () => {
    const f = await fixture(),
      p = await plan(f),
      b = await start(f, p),
      original = providerAdapter.submit;
    const a = await imageAsset(f.ws.id);
    let calls = 0;
    providerAdapter.submit = async (form, hooks) => {
      calls++;
      const jobId = String(form.get("jobId"));
      await prisma.job.create({
        data: {
          id: jobId,
          workspaceId: f.ws.id,
          userId: "user-with-settings",
          type: "image",
          status: "queueing_up",
          modelId: "krea2-turbo",
          options: JSON.stringify({ mcpProvenance: hooks.metadata }),
        },
      });
      await hooks.beforeProviderSubmit({ endpointId: "fake", secureState: {} });
      await hooks.afterProviderAccepted("mock-" + calls);
      await prisma.job.update({
        where: { id: jobId },
        data: { status: "completed", resultUrl: a.originalUrl },
      });
      return Response.json({ success: true });
    };
    try {
      for (let i = 0; i < 4; i++) await processMcpWorkspace(f.ws.id);
      const batch = await f.call("engui_get_batch", { batchId: b.batchId });
      expect(batch.state).toBe("completed");
      expect(calls).toBe(3);
      expect(
        batch.variants.every(
          (v: any) => v.preservationState === "saved" && v.assetId,
        ),
      ).toBe(true);
      for (const v of batch.variants)
        directories.push(
          path.join(process.cwd(), "public", "generations", "gallery", f.ws.id),
        );
      const assetId = batch.variants[0].assetId;
      await f.call("engui_record_concept_review", {
        characterId: f.character.id,
        assetId,
        decision: "approved",
        expectedRevision: 0,
        requestKey: randomUUID(),
      });
      await scope(f.ws.id, () =>
        prisma.job.deleteMany({ where: { workspaceId: f.ws.id } }),
      );
      expect(
        (
          await f.call("engui_get_image", {
            source: { kind: "gallery_asset", assetId },
          })
        ).sha256,
      ).toBe(a.contentHash);
      expect(
        (
          await f.call("engui_get_concept_reference", {
            characterId: f.character.id,
          })
        ).reference.sourceAvailable,
      ).toBe(true);
    } finally {
      providerAdapter.submit = original;
    }
  });
  it("persisted acceptance recovers without another provider submission", async () => {
    const f = await fixture(),
      p = await plan(f, { variantCount: 1 }),
      b = await start(f, p),
      original = providerAdapter.submit;
    let calls = 0;
    providerAdapter.submit = async (form, hooks) => {
      calls++;
      await prisma.job.create({
        data: {
          id: String(form.get("jobId")),
          workspaceId: f.ws.id,
          userId: "user-with-settings",
          type: "image",
          status: "queueing_up",
          modelId: "krea2-turbo",
        },
      });
      await hooks.beforeProviderSubmit({ endpointId: "fake", secureState: {} });
      await hooks.afterProviderAccepted("known-receipt");
      throw Error("Crash after receipt");
    };
    try {
      await processMcpWorkspace(f.ws.id);
      await processMcpWorkspace(f.ws.id);
      const batch = await f.call("engui_get_batch", { batchId: b.batchId });
      expect(batch.variants[0].state).toBe("running");
      expect(calls).toBe(1);
    } finally {
      providerAdapter.submit = original;
    }
  });
  it("a deleting workspace rejects tool traffic and cannot dispatch queued work", async () => {
    const f = await fixture(),
      p = await plan(f),
      b = await start(f, p);
    await prisma.workspace.update({
      where: { id: f.ws.id },
      data: { lifecycle: "deleting" },
    });
    expect(
      (
        await handleMcpRequest(
          new Request("http://localhost/api/mcp", { headers: f.headers }),
        )
      ).status,
    ).toBe(409);
    await processMcpWorkspace(f.ws.id);
    expect(await prisma.job.count({ where: { workspaceId: f.ws.id } })).toBe(0);
  });
  it("retired request keys remain tombstones rather than creating paid work", async () => {
    const f = await fixture(),
      key = randomUUID(),
      p = await plan(f, { requestKey: key });
    await scope(f.ws.id, () =>
      prisma.mcpOperationReceipt.updateMany({
        where: { requestKey: key },
        data: { retiredAt: new Date() },
      }),
    );
    await expect(plan(f, { requestKey: key })).rejects.toMatchObject({
      code: "OPERATION_RETIRED",
    });
    expect(
      await prisma.mcpGenerationPlan.count({ where: { workspaceId: f.ws.id } }),
    ).toBe(1);
  });

  it("shared Default LoRA is the only cross-workspace library exception", async () => {
    const a = await fixture(),
      b = await fixture();
    await prisma.workspace.update({
      where: { id: b.ws.id },
      data: { isProtected: true },
    });
    const l = await scope(b.ws.id, () =>
      prisma.loRA.create({
        data: {
          workspaceId: b.ws.id,
          name: "Shared style",
          fileName: "style.safetensors",
          s3Path: "/runpod-volume/loras/style.safetensors",
          s3Url: "https://fixture.invalid/style",
          fileSize: BigInt(1),
          extension: ".safetensors",
          baseModel: "krea2-turbo",
          sourceKey: "loras/style.safetensors",
          storageTarget: "fixture",
          isShared: true,
        },
      }),
    );
    expect(
      (
        await a.call("engui_list_presets", {
          kind: "loras",
          modelId: "krea2-turbo",
        })
      ).items.some((row: any) => row.id === l.id && row.shared),
    ).toBe(true);
    const p = await plan(a, { loras: [{ id: l.id, weight: 0.8 }] });
    expect(p.snapshot.loras[0].shared).toBe(true);
    await scope(b.ws.id, () =>
      prisma.loRA.update({ where: { id: l.id }, data: { isShared: false } }),
    );
    await expect(start(a, p)).rejects.toThrow();
  });
  it("hashes and byte ownership cannot be bypassed with a forged path or reference ID", async () => {
    const a = await fixture(),
      b = await fixture();
    const image = await imageAsset(b.ws.id);
    const foreign = await scope(a.ws.id, () =>
      prisma.galleryAsset.create({
        data: {
          workspaceId: a.ws.id,
          type: "image",
          contentHash: image.contentHash,
          originalUrl: `/generations/gallery/${b.ws.id}/foreign.png`,
        },
      }),
    );
    await expect(
      a.call("engui_get_image", {
        source: { kind: "gallery_asset", assetId: foreign.id },
      }),
    ).rejects.toThrow();
    await expect(
      plan(a, {
        modelId: "z-image",
        mode: "image_to_image",
        references: [{ kind: "gallery_asset", assetId: image.id }],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("rate limits are durable per credential and include a retry hint", async () => {
    const f = await fixture();
    process.env.ENGUI_MCP_PREPARE_PER_MINUTE = "1";
    try {
      await plan(f);
      await expect(plan(f)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    } finally {
      process.env.ENGUI_MCP_PREPARE_PER_MINUTE = "120";
    }
  });
  it("a missing approved asset is reported unavailable, never replaced", async () => {
    const f = await fixture(),
      asset = await imageAsset(f.ws.id),
      p = await plan(f, {
        modelId: "qwen-image-edit",
        mode: "image_edit",
        references: [{ kind: "gallery_asset", assetId: asset.id }],
      });
    await f.call("engui_record_concept_review", {
      characterId: f.character.id,
      assetId: asset.id,
      snapshotPlanId: p.planId,
      decision: "approved",
      expectedRevision: 0,
      requestKey: randomUUID(),
    });
    await scope(f.ws.id, () =>
      prisma.galleryAsset.update({
        where: { id: asset.id },
        data: { trashed: true },
      }),
    );
    const ref = await f.call("engui_get_concept_reference", {
      characterId: f.character.id,
    });
    expect(ref.reference.assetId).toBe(asset.id);
    expect(ref.reference.sourceAvailable).toBe(false);
  });
  it("provider rejection is terminal, distinct from unknown acceptance", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("invalid request", { status: 400 }));
    vi.stubGlobal("fetch", fetcher);
    try {
      await expect(
        new RunPodService("fixture", "fixture-endpoint").submitJob(
          { prompt: "fixture" } as any,
          undefined,
          { noRetry: true },
        ),
      ).rejects.toMatchObject({ code: "PROVIDER_REJECTED" });
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("reports partial success honestly", () => {
    expect(
      batchState([{ state: "succeeded" }, { state: "failed" }], false),
    ).toBe("partial");
    expect(batchState([{ state: "submission_unknown" }], true)).toBe(
      "needs_attention",
    );
  });
});
