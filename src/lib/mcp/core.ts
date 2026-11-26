import { createHash } from "node:crypto";
import { z } from "zod";
import { authoringInputSchemas } from "./authoring-schemas";
import { vibeInputSchemas } from "./vibe-schemas";
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
export const maxDeleteBatchItems = 100;
const galleryDeleteItem = z.object({ assetId: id, expectedRevision: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const uniqueIds = (items: string[]) => new Set(items).size === items.length;
export const mediaRef = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("gallery_asset"), assetId: id }).strict(),
  z.object({ kind: z.literal("job_output"), jobId: id, outputId: id }).strict(),
]);
export type MediaRef = z.infer<typeof mediaRef>;
// Internal bridge only; deliberately absent from public MCP input schemas.
export type InternalMediaRef = MediaRef | { kind: "dataset_upload"; uploadId: string };
export const maskInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("image"), source: mediaRef }).strict(),
  z.object({ kind: z.literal("rectangles"), regions: z.array(z.object({
    x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1),
    width: z.number().finite().positive().max(1), height: z.number().finite().positive().max(1),
  }).strict().refine(r => r.x + r.width <= 1 && r.y + r.height <= 1, "Mask region exceeds source bounds")).min(1).max(32) }).strict(),
]);
export type MaskInput = z.infer<typeof maskInput>;
export const regionalMaskInput = z.union([
  maskInput,
  z.object({ kind: z.literal("polygon"), points: z.array(z.object({
    x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1),
  }).strict()).min(3).max(64) }).strict(),
]);
export type RegionalMaskInput = z.infer<typeof regionalMaskInput>;
export const regionInput = z.object({
  prompt: z.string().trim().min(1).max(16000).describe("This region's subject/action. Supports Character tags and seeded alternatives. Keep permanent identity in Character cards."),
  loras: z.array(z.object({ id, weight: z.number().finite().min(-10).max(10) }).strict()).min(1).max(8),
  mask: regionalMaskInput.describe("Region of LoRA influence in output-canvas coordinates, not a pose or an edit mask."),
}).strict();
export const modelId = z.enum(["krea2-turbo", "z-image", "qwen-image-edit", "qwen-image-edit-maskflow"]);
export const page = {
  query: z.string().max(256).optional(),
  cursor: z.string().max(2048).optional(),
  limit: z.number().int().min(1).max(50).default(20),
};
export const draftSchema = z
  .object({
    parentBatchId: id.optional(),
    mode: z.enum(["text_to_image", "image_to_image", "image_edit", "masked_image_edit"]),
    modelId,
    prompt: z.string().min(1).max(16000).describe("Generation text. No Character selection or implicit identity/outfit. Supports {character:UUID}, {character:UUID:withOutfit}, stored {key} wildcards and seeded {a|b} choices. Read engui_get_prompt_guide."),
    negativePrompt: z.string().max(16000).optional(),
    framing: z.enum(["full_body", "portrait", "custom"]).default("custom"),
    view: z.enum(["front", "three_quarter", "side", "custom"]).optional(),
    vibeId: id.optional().describe("Optional active Vibe ID from engui_list_vibes / engui_create_vibe. Its description is prepended exactly once before wildcard/Character expansion. Omit for no Vibe; do not copy its text into prompt."),
    references: z.array(mediaRef).max(2).default([]),
    mask: maskInput.optional().describe("Required only for qwen-image-edit-maskflow. Grayscale aligned mask image (white edits, black preserves), or normalized rectangles in source coordinates. Not a second reference image."),
    regions: z.array(regionInput).min(1).max(4).optional().describe("Krea2 Turbo text_to_image only: per-region prompts and LoRAs. Rectangles/polygon coordinates are normalized 0..1; grayscale image masks must match output dimensions. Eight total LoRA slots including global loras."),
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
export type InternalGenerationDraft = Omit<GenerationDraft, "references"> & { references: InternalMediaRef[] };
export const limits = () => ({
  maxVariants: 3,
  maxReferenceImages: 2,
  maxImageBytes: 25 * 1024 * 1024,
  maxImagePixels: 40_000_000,
  maxPreviewBytes: 1024 * 1024,
  artifactLinkTtlSeconds: 600,
  uploadLinkTtlSeconds: 600,
  uploadsPerMinute: 10,
  maxPageSize: 50,
  maxDeleteBatchItems,
  activeBatches: boundedEnv("ENGUI_MCP_MAX_BATCHES", 2, 1, 10),
  preparePerMinute: boundedEnv("ENGUI_MCP_PREPARE_PER_MINUTE", 10, 1, 120),
  callsPerMinute: boundedEnv("ENGUI_MCP_CALLS_PER_MINUTE", 120, 1, 1000),
});
function boundedEnv(key: string, fallback: number, min: number, max: number) {
  const n = Number(process.env[key] || fallback);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}
export const uploadInput = z.object({
  filename: z.string().min(1).max(200).regex(/^[^\\/\x00-\x1f\x7f]+$/).refine(s => s !== "." && s !== "..", "Supply a filename, not a path"),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  byteLength: z.number().int().positive().max(25 * 1024 * 1024),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  requestKey,
}).strict();
export const inputSchemas = {
  ...authoringInputSchemas,
  ...vibeInputSchemas,
  engui_get_context: z.object({}).strict(),
  engui_get_prompt_guide: z.object({}).strict(),
  engui_list_wildcards: z.object(page).strict(),
  engui_list_models: z.object({}).strict(),
  engui_list_characters: z.object(page).strict(),
  engui_get_character: z.object({ characterId: id, characterVersionId: id.optional() }).strict(),
  engui_list_presets: z
    .object({
      ...page,
      kind: z.enum(["outfits", "vibes", "loras"]),
      characterId: id.optional(),
      modelId: modelId.optional(),
    })
    .strict(),
  engui_search_gallery: z
    .object({ ...page, favoritesOnly: z.boolean().default(false), bucket: z.enum(["common", "draft", "upscale"]).optional(), status: z.enum(["active", "trash"]).default("active") })
    .strict(),
  engui_get_gallery_asset: z.object({ assetId: id }).strict(),
  engui_delete_gallery_asset: z.object({ assetId: id, expectedRevision: z.string().regex(/^[a-f0-9]{64}$/), requestKey }).strict(),
  engui_delete_gallery_assets: z.object({ items: z.array(galleryDeleteItem).min(1).max(maxDeleteBatchItems).refine(items => uniqueIds(items.map(item => item.assetId)), "Duplicate assetIds are not allowed"), requestKey }).strict(),
  engui_restore_gallery_asset: z.object({ assetId: id, expectedRevision: z.string().regex(/^[a-f0-9]{64}$/), requestKey }).strict(),
  engui_get_image: z
    .object({
      source: mediaRef,
      maxEdge: z.union([z.literal(512), z.literal(1024)]).default(512),
    })
    .strict(),
  engui_download_artifact: z.object({ source: mediaRef }).strict(),
  engui_create_upload: uploadInput,
  engui_get_upload: z.object({ uploadId: requestKey }).strict(),
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
  engui_delete_job: z.object({ jobId: id, requestKey }).strict(),
  engui_delete_jobs: z.object({ jobIds: z.array(id).min(1).max(maxDeleteBatchItems).refine(uniqueIds, "Duplicate jobIds are not allowed"), requestKey }).strict(),
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
  return name === "engui_create_upload" || name === "engui_prepare_generation" ||
    name === "engui_start_generation"
    ? "generate"
    : name === "engui_cancel_batch" || name === "engui_delete_job" || name === "engui_delete_jobs"
      ? "cancel"
      : name === "engui_save_output" || name === "engui_record_concept_review" ||
        ["engui_delete_gallery_asset", "engui_delete_gallery_assets", "engui_restore_gallery_asset", "engui_create_vibe", "engui_update_vibe", "engui_delete_vibe", "engui_restore_vibe", "engui_create_character", "engui_update_character", "engui_create_outfit", "engui_update_outfit", "engui_update_wardrobe"].includes(name)
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
  const bucket = name === "engui_create_upload" ? "uploads" : [
    "engui_prepare_generation",
    "engui_start_generation",
  ].includes(name)
    ? "generation"
    : "tools";
  const max = bucket === "uploads" ? limits().uploadsPerMinute :
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
