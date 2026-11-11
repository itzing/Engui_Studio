import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceId } from "@/lib/workspaces/context";

export class McpError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryable = false,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}
export function fail(code: string, message: string): never {
  throw new McpError(code, message);
}
export function canonical(value: unknown): string {
  if (Array.isArray(value))
    return "[" + value.map((v) => canonical(v ?? null)).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "null";
}
export const digest = (value: unknown) =>
  createHash("sha256").update(canonical(value)).digest("hex");
export const parse = (raw: string | null | undefined) => {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
};
export const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const requestKey = z.string().uuid();
export const mediaRef = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("gallery_asset"), assetId: id }).strict(),
  z.object({ kind: z.literal("job_output"), jobId: id, outputId: id }).strict(),
]);
export type MediaRef = z.infer<typeof mediaRef>;
export const modelId = z.enum(["krea2-turbo", "z-image", "qwen-image-edit"]);
export const page = {
  query: z.string().max(256).optional(),
  cursor: z.string().max(2048).optional(),
  limit: z.number().int().min(1).max(50).default(20),
};
export const draftSchema = z
  .object({
    characterId: id,
    characterVersionId: id.optional(),
    parentBatchId: id.optional(),
    mode: z.enum(["text_to_image", "image_to_image", "image_edit"]),
    modelId,
    prompt: z.string().min(1).max(16000),
    negativePrompt: z.string().max(16000).optional(),
    framing: z.enum(["full_body", "portrait", "custom"]).default("full_body"),
    view: z.enum(["front", "three_quarter", "side", "custom"]).optional(),
    outfitId: id.optional(),
    vibeId: id.optional(),
    references: z.array(mediaRef).max(2).default([]),
    width: z.number().int().default(1024),
    height: z.number().int().default(1024),
    variantCount: z
      .union([z.literal(1), z.literal(2), z.literal(3)])
      .default(3),
    seeds: z
      .array(z.number().int().min(0).max(2147483647))
      .min(1)
      .max(3)
      .optional(),
    parameters: z
      .object({
        steps: z.number().int().optional(),
        cfg: z.number().finite().optional(),
        guidance: z.number().finite().optional(),
        denoise: z.number().finite().optional(),
      })
      .strict()
      .default({}),
    loras: z
      .array(
        z.object({ id, weight: z.number().finite().min(-10).max(10) }).strict(),
      )
      .max(8)
      .default([]),
    requestKey,
  })
  .strict();
export type GenerationDraft = z.infer<typeof draftSchema>;
export const limits = () => ({
  maxVariants: 3,
  maxReferenceImages: 2,
  maxImageBytes: 25 * 1024 * 1024,
  maxImagePixels: 40_000_000,
  maxPreviewBytes: 1024 * 1024,
  maxPageSize: 50,
  activeBatches: boundedEnv("ENGUI_MCP_MAX_BATCHES", 2, 1, 10),
  preparePerMinute: boundedEnv("ENGUI_MCP_PREPARE_PER_MINUTE", 10, 1, 120),
  callsPerMinute: boundedEnv("ENGUI_MCP_CALLS_PER_MINUTE", 120, 1, 1000),
});
function boundedEnv(key: string, fallback: number, min: number, max: number) {
  const n = Number(process.env[key] || fallback);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}
export const inputSchemas = {
  engui_get_context: z.object({}).strict(),
  engui_list_models: z.object({}).strict(),
  engui_list_characters: z.object(page).strict(),
  engui_get_character: z.object({ characterId: id }).strict(),
  engui_list_presets: z
    .object({
      ...page,
      kind: z.enum(["outfits", "vibes", "loras"]),
      characterId: id.optional(),
      modelId: modelId.optional(),
    })
    .strict(),
  engui_search_gallery: z
    .object({ ...page, favoritesOnly: z.boolean().default(false) })
    .strict(),
  engui_get_image: z
    .object({
      source: mediaRef,
      maxEdge: z.union([z.literal(512), z.literal(1024)]).default(512),
    })
    .strict(),
  engui_prepare_generation: draftSchema,
  engui_get_plan: z.object({ planId: id }).strict(),
  engui_start_generation: z
    .object({
      planId: id,
      planDigest: z.string().regex(/^[a-f0-9]{64}$/),
      requestKey,
    })
    .strict(),
  engui_get_batch: z.object({ batchId: id }).strict(),
  engui_cancel_batch: z.object({ batchId: id, requestKey }).strict(),
  engui_save_output: z
    .object({
      source: mediaRef,
      bucket: z.enum(["common", "draft"]).default("common"),
      requestKey,
    })
    .strict(),
  engui_record_concept_review: z
    .object({
      characterId: id,
      assetId: id,
      snapshotPlanId: id.optional(),
      decision: z.enum(["shortlisted", "rejected", "approved"]),
      expectedRevision: z.number().int().nonnegative(),
      notes: z.string().max(2000).default(""),
      requestKey,
    })
    .strict(),
  engui_get_concept_reference: z.object({ characterId: id }).strict(),
};
export type ToolName = keyof typeof inputSchemas;
export function scopeFor(name: ToolName): string {
  return name === "engui_prepare_generation" ||
    name === "engui_start_generation"
    ? "generate"
    : name === "engui_cancel_batch"
      ? "cancel"
      : name === "engui_save_output" || name === "engui_record_concept_review"
        ? "curate"
        : "read";
}
export type Authority = {
  credentialId: string;
  workspace: { id: string; name: string; revision: number };
  ownerId: string;
  scopes: string[];
};
export async function findReceipt(
  operation: string,
  key: string,
  input: unknown,
  db: any = prisma,
) {
  const row = await db.mcpOperationReceipt.findFirst({
    where: { workspaceId: requireWorkspaceId(), operation, requestKey: key },
  });
  if (!row) return null;
  if (row.inputDigest !== digest(input))
    fail(
      "IDEMPOTENCY_CONFLICT",
      "This request key was used with different input.",
    );
  if (row.retiredAt)
    fail(
      "OPERATION_RETIRED",
      "This operation is retired and cannot be replayed.",
    );
  return parse(row.resultJson);
}
export async function receipt<T>(
  operation: string,
  key: string,
  input: unknown,
  work: (tx: any) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await findReceipt(operation, key, input);
    if (existing) return existing;
    try {
      return await prisma.$transaction(async (tx) => {
        const again = await findReceipt(operation, key, input, tx);
        if (again) return again;
        const result = await work(tx);
        await tx.mcpOperationReceipt.create({
          data: {
            workspaceId: requireWorkspaceId(),
            operation,
            requestKey: key,
            inputDigest: digest(input),
            resultJson: JSON.stringify(result),
          },
        });
        return result;
      });
    } catch (error: any) {
      if (!["P2002", "P2034", "P1008"].includes(error.code) || attempt === 2)
        throw error;
      // Retry only a rolled-back local transaction. No provider calls occur here.
    }
  }
  throw new McpError(
    "INTERNAL_ERROR",
    "Local operation could not be committed.",
  );
}
export async function rateLimit(auth: Authority, name: ToolName) {
  const bucket = [
    "engui_prepare_generation",
    "engui_start_generation",
  ].includes(name)
    ? "generation"
    : "tools";
  const max =
    bucket === "generation"
      ? limits().preparePerMinute
      : limits().callsPerMinute;
  const window = Math.floor(Date.now() / 60000);
  const key = digest([auth.credentialId, bucket, window]);
  const row = await prisma.mcpRateLimit.upsert({
    where: { id: key },
    create: {
      id: key,
      workspaceId: auth.workspace.id,
      credentialId: auth.credentialId,
      bucket,
      window,
      count: 1,
    },
    update: { count: { increment: 1 } },
  });
  if (row.count > max)
    throw new McpError("RATE_LIMITED", "Request rate exceeded.", true, {
      retryAfterSeconds: 60 - (Math.floor(Date.now() / 1000) % 60),
    });
}
export function pageCursor(
  raw: string | undefined,
  filter: unknown,
): string | undefined {
  if (!raw) return;
  try {
    const c = JSON.parse(Buffer.from(raw, "base64url").toString());
    if (
      c.scope !== digest([requireWorkspaceId(), filter]) ||
      typeof c.last !== "string"
    )
      throw Error();
    return id.parse(c.last);
  } catch {
    fail("INVALID_ARGUMENT", "Invalid cursor for this workspace or filter.");
  }
}
export function nextCursor(last: string, filter: unknown): string {
  return Buffer.from(
    JSON.stringify({ scope: digest([requireWorkspaceId(), filter]), last }),
  ).toString("base64url");
}
