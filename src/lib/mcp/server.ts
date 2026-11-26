import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { withWorkspaceActivity } from "@/lib/workspaces/activity";
import { WorkspaceError } from "@/lib/workspaces/context";
import { authenticate, HttpError, inAuthority } from "./auth";
import {
  inputSchemas,
  limits,
  McpError,
  rateLimit,
  scopeFor,
  type Authority,
  type ToolName,
} from "./core";
import { characterDetail, listModels, listRecords } from "./catalog";
import { imagePreview } from "./media";
import { downloadArtifact } from "./artifacts";
import { createUpload, getUpload } from "./uploads";
import { createVibe, changeVibe, getVibe, listVibes } from "./vibes";
import { visibleParts } from "./authoring-schemas";
import { createCharacter, updateCharacter, listCharacterVersions, getOutfit, createOutfit, updateOutfit, getWardrobe, updateWardrobe } from "./authoring";
import { getPlan, prepareGeneration } from "./plans";
import { deleteJob } from "./jobs";
import { deleteJobs, deleteGalleryAssets } from "./bulk-delete";
import { cancelBatch, getBatch, startGeneration } from "./batches";
import { getGalleryAsset, changeGalleryTrash } from "./gallery";
import { getReference, recordReview, saveOutput } from "./curation";
import { MCP_VERSION, MCP_INSTRUCTIONS, PROMPT_GUIDE, PROMPT_GUIDE_URI } from "./guide";

import { variantStates, batchStates } from "./batch-status";

const nullable = z.string().nullable(),
  json = z.record(z.unknown());
const list = z.object({ items: z.array(json), nextCursor: nullable });
const characterWrite = z.object({ characterId: z.string(), characterVersionId: nullable, editRevision: z.string(), changed: z.boolean() });
const outfitRead = z.object({ outfitId: z.string(), ownerCharacterId: nullable, name: z.string(), description: z.string(), constraints: z.string(), coversFace: z.boolean(), revision: z.number(), visibleParts: visibleParts.nullable() });
const uploadResult = z.object({ uploadId: z.string(), status: z.enum(["pending", "ready"]), filename: z.string(), mimeType: z.string(), byteLength: z.number(), sha256: z.string(), source: json.nullable(), width: z.number().nullable(), height: z.number().nullable() });
const vibeRead = z.object({ id: z.string(), name: z.string(), baseDescription: z.string(), tags: z.array(z.string()), compatibleSceneTypes: z.array(z.string()), status: z.enum(["active", "trash"]), createdAt: z.string(), updatedAt: z.string(), editRevision: z.string(), preferred: z.literal(true).optional() });
const galleryRead = z.object({ assetId: z.string(), bucket: z.string(), status: z.enum(["active", "trash"]), sha256: z.string(), favorited: z.boolean(), source: json, sourceJobId: nullable, sourceOutputId: nullable, addedAt: z.string(), updatedAt: z.string(), editRevision: z.string() });
const vibeWrite = vibeRead.extend({ changed: z.boolean() });
const itemError = z.object({ code: z.string(), message: z.string(), retryable: z.boolean() });
const bulkResult = (item: z.ZodTypeAny) => z.object({
  requestKey: z.string().uuid(), total: z.number().int(), succeeded: z.number().int(), failed: z.number().int(), results: z.array(item),
});
const jobDeleteResult = z.discriminatedUnion("ok", [
  z.object({ jobId: z.string(), ok: z.literal(true), alreadyAbsent: z.boolean() }),
  z.object({ jobId: z.string(), ok: z.literal(false), error: itemError }),
]);
const galleryDeleteResult = z.discriminatedUnion("ok", [
  z.object({ assetId: z.string(), ok: z.literal(true), status: z.literal("trash"), bucket: z.string(), changed: z.boolean(), editRevision: z.string() }),
  z.object({ assetId: z.string(), ok: z.literal(false), error: itemError }),
]);
export const outputSchemas: Record<ToolName, z.ZodTypeAny> = {
  engui_list_vibes: z.object({ items: z.array(vibeRead), nextCursor: nullable }),
  engui_get_vibe: vibeRead,
  engui_create_vibe: vibeWrite,
  engui_update_vibe: vibeWrite,
  engui_delete_vibe: vibeWrite,
  engui_restore_vibe: vibeWrite,
  engui_create_upload: uploadResult.extend({ uploadUrl: z.string().url().nullable(), expiresAt: nullable, method: z.literal("PUT"), contentType: z.string() }),
  engui_get_upload: uploadResult,
  engui_create_character: characterWrite,
  engui_update_character: characterWrite,
  engui_list_character_versions: z.object({ characterId: z.string(), currentVersionId: nullable, items: z.array(json), nextCursor: nullable }),
  engui_get_outfit: outfitRead,
  engui_create_outfit: outfitRead,
  engui_update_outfit: outfitRead,
  engui_get_wardrobe: z.object({ characterId: z.string(), defaultOutfitId: nullable, editRevision: z.string(), items: z.array(json), nextCursor: nullable }),
  engui_update_wardrobe: characterWrite,
  engui_get_context: z.object({
    scopes: z.array(z.string()),
    serverVersion: z.string(),
    limits: json,
    operations: z.array(z.string()),
  }),
  engui_get_prompt_guide: z.object({ version: z.string(), uri: z.string(), markdown: z.string() }),
  engui_list_wildcards: list,
  engui_list_models: z.object({
    models: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        modes: z.array(z.string()),
        configured: z.boolean(),
        enabledByOwner: z.boolean(),
        available: z.boolean(),
        availabilityReason: nullable,
        health: z.null(),
        parameters: z.array(json),
        maxReferences: z.number(),
        maxLoras: z.number(),
        mask: json.optional(),
        regional: json.optional(),
      }),
    ),
  }),
  engui_list_characters: list,
  engui_get_character: z.object({
    characterId: z.string(),
    characterName: z.string(),
    characterVersionId: nullable,
    editRevision: nullable,
    defaultOutfitId: nullable,
    identityParts: visibleParts.nullable(),
    traits: json,
    gender: nullable,
    look: json,
    digest: z.string(),
    outfits: z.array(
      z.object({ id: z.string(), name: z.string(), revision: z.number() }),
    ),
    reference: z.object({ assetId: nullable, revision: z.number() }).nullable(),
  }),
  engui_list_presets: list,
  engui_search_gallery: list,
  engui_get_gallery_asset: galleryRead,
  engui_delete_gallery_asset: galleryRead.extend({ changed: z.boolean() }),
  engui_delete_gallery_assets: bulkResult(galleryDeleteResult),
  engui_restore_gallery_asset: galleryRead.extend({ changed: z.boolean() }),
  engui_get_image: z.object({
    source: json,
    originalWidth: z.number(),
    originalHeight: z.number(),
    sha256: z.string(),
    mimeType: z.string(),
    width: z.number(),
    height: z.number(),
    byteLength: z.number(),
  }),
  engui_download_artifact: z.object({ source: json, filename: z.string(), mimeType: z.string(), byteLength: z.number(), sha256: z.string(), downloadUrl: z.string().url(), expiresAt: z.string(), original: z.literal(true) }),
  engui_prepare_generation: z.object({
    planId: z.string(),
    planDigest: z.string(),
    expiresAt: z.string(),
    snapshot: json,
    batchId: nullable,
  }),
  engui_get_plan: z.object({
    planId: z.string(),
    planDigest: z.string(),
    expiresAt: z.string(),
    snapshot: json,
    batchId: nullable,
  }),
  engui_start_generation: z.object({
    batchId: z.string(),
    planId: z.string(),
    variants: z.array(
      z.object({ variantId: z.string(), label: z.string(), jobId: z.string() }),
    ),
    accepted: z.boolean(),
  }),
  engui_get_batch: z.object({
    batchId: z.string(), planId: z.string(), state: z.enum(batchStates),
    statusMessage: z.string(), isTerminal: z.boolean(), cancellationRequested: z.boolean(), observedAt: z.string(),
    counts: z.object({
      total: z.number(), queued: z.number(), blocked: z.number(), submitting: z.number(),
      providerQueued: z.number(), running: z.number(), finalizing: z.number(), awaitingStatus: z.number(),
      submissionUnknown: z.number(), cancelRequested: z.number(), succeeded: z.number(), failed: z.number(), cancelled: z.number(), abandoned: z.number(),
    }),
    variants: z.array(z.object({
      variantId: z.string(), label: z.string(), jobId: z.string(), state: z.enum(variantStates), phase: z.enum(variantStates),
      lifecycleState: z.string(), jobStatus: nullable, providerAccepted: z.boolean(), cancellationRequested: z.boolean(),
      blockedReason: nullable, isTerminal: z.boolean(), statusMessage: z.string(), seed: z.number(), modelId: z.string(),
      errorCode: nullable, outputId: nullable, assetId: nullable, preservationState: z.string(), source: json.nullable(), gallery: json.nullable(),
    })),
    provenance: json, pollAfterSeconds: z.number(),
  }),
  engui_cancel_batch: z.object({
    batchId: z.string(),
    cancellationRequested: z.boolean(),
    locallyStoppedJobIds: z.array(z.string()), providerOutcomeUnknown: z.boolean(),
  }),
  engui_delete_job: z.object({deletedJobId:z.string(),alreadyAbsent:z.boolean()}),
  engui_delete_jobs: bulkResult(jobDeleteResult),
  engui_save_output: galleryRead.partial().extend({ assetId: z.string(), sha256: z.string(), bucket: z.string(), alreadySaved: z.boolean(), action: z.enum(["created", "moved", "unchanged"]).optional(), previousBucket: nullable.optional() }),
  engui_record_concept_review: z.object({
    reviewId: z.string(),
    characterId: z.string(),
    assetId: z.string(),
    decision: z.string(),
    revision: z.number(),
  }),
  engui_get_concept_reference: z.object({
    characterId: z.string(),
    revision: z.number(),
    reference: json.nullable(),
  }),
};
const descriptions: Record<ToolName, string> = {
  engui_delete_jobs: "Delete 1–100 unique full jobIds in one call with cancel scope and one UUID requestKey. Same safeguards as engui_delete_job: no automatic cancellation; busy/unpreserved Jobs return per-item errors. Gallery copies and generation evidence remain. Returns total/succeeded/failed and ordered results with jobId, ok, alreadyAbsent or error. Partial success is not rolled back. Retry interrupted calls with identical key/payload; reported failures are frozen too, so re-read them and use a NEW key for an intentional retry. No provider calls.",
  engui_delete_gallery_assets: "Move 1–100 Gallery images to reversible Trash in one call. Requires curate, items:[{assetId,expectedRevision}] and one UUID requestKey. Take full IDs and editRevision from engui_search_gallery (no per-item read needed) or get_gallery_asset. No duplicates. Per-item ok/status/changed/editRevision or error, plus counts; stale/missing items do not stop other items. Retry identical key/payload to resume/replay, never re-trash restored items; reported failures need refreshed revisions and a NEW key to retry. Does not delete Jobs or original files. Receipts are historical, not current Gallery state.",
  engui_list_vibes: "List full workspace Vibe presets with tags, compatibleSceneTypes and editRevision. preferred=true marks the owner-recommended Vibe, informational only: pass vibeId explicitly. The field is omitted for all other presets/workspaces. Active by default; status=trash lists deleted presets for restoration. query matches names/tags. Use returned id as vibeId in engui_prepare_generation; no inference.",
  engui_get_vibe: "Read a workspace Vibe, including trash, with exact baseDescription and editRevision. preferred=true is an optional owner recommendation, never automatic selection. Read before editing/deleting/restoring. IDs from another workspace are unavailable.",
  engui_create_vibe: "Create an ordinary workspace Vibe (name, reusable baseDescription, optional tags/compatibleSceneTypes). Returns id for generation vibeId and editRevision. Tags are normalized like UI; scene types are advisory metadata. Requires curate; no inference. Retry the same requestKey/payload.",
  engui_update_vibe: "Partially edit an active Vibe. Supply expectedRevision from fresh engui_get_vibe and changes. Omitted fields stay unchanged; [] clears tags/compatibleSceneTypes. Existing scenes/plans/jobs are never rewritten. Changed description/name invalidates unstarted plans; prepare anew. Requires curate; retry same requestKey/payload.",
  engui_delete_vibe: "Move a Vibe to trash, as in UI; not permanent erasure. Requires expectedRevision and curate scope. Hidden from active lists; unavailable to new generation and invalidates pending plans. Historical plans/results stay intact. Retry same requestKey/payload; restore with engui_restore_vibe.",
  engui_restore_vibe: "Restore a trashed workspace Vibe to active using fresh expectedRevision and UUID requestKey. No generation or plan rewrite. Read current Vibe and prepare a new plan when needed. Requires curate.",
  engui_create_upload: "Upload a local source/mask image: supply filename (not path), actual MIME, byteLength, lowercase SHA-256 and UUID requestKey. Returns a private temporary uploadUrl: PUT raw file bytes with contentType using a local-file HTTP client; no MCP headers needed. Do not send base64 or URLs to this tool. PUT returns a reusable Gallery source; engui_get_upload recovers lost responses. Static PNG/JPEG/WebP,25MiB/40MP; exact original is stored in workspace Draft. Same key/payload renews an expired link or returns the existing source. Requires generate scope; upload never starts inference. Read engui_get_prompt_guide for Z-Image i2i.",
  engui_get_upload: "Read upload status and reusable source after HTTP PUT, including after an uncertain upload response. uploadId comes from engui_create_upload. pending means no validated file yet; ready contains source for references or image mask. Bound to the creating credential/workspace; no upload or inference. Deleted/trashed files are not restored by retries.",
  engui_create_character: "Create an ordinary workspace Character and its first identity version. Optional identityParts classify visible details by body region. Local write only; no generation. Reuse requestKey for retries.",
  engui_update_character: "Partially edit a character and append an identity version. Use editRevision from a fresh engui_get_character as expectedRevision. changes.traits merges keys; null deletes a key; omitted values/UI state are preserved. Identity changes clear old classification unless identityParts are supplied. Never generates; prepare a new plan after editing. Retry with the same requestKey.",
  engui_list_character_versions: "List immutable identity versions and traits, paginated by opaque cursor. identityComplete=false means historical name/gender were not captured; never invent them. Read a captured version with engui_get_character(characterVersionId).",
  engui_get_outfit: "Read an outfit, its visible parts and revision before editing. Workspace-scoped; no generation.",
  engui_create_outfit: "Create a workspace outfit or a personal outfit with ownerCharacterId. Personal outfits are linked to their owner, not automatically made default. visibleParts classify clothing by body region for cropped prompts. No generation.",
  engui_update_outfit: "Partially update an outfit using expectedRevision from engui_get_outfit. Omitted fields stay unchanged. Changed clothing text clears outdated classification unless visibleParts are supplied. Shared workspace outfits affect every character using them. No generation.",
  engui_get_wardrobe: "Read available outfits with linked/default flags and current character editRevision. Follow nextCursor for further outfits.",
  engui_update_wardrobe: "Link, select default, unlink or clear a character's default outfit using current editRevision as expectedRevision. clearDefault omits outfitId; other actions require it. Unlinking the default clears that selection, never deletes the outfit. No generation.",
  engui_get_prompt_guide: "Read the complete workflow and prompt syntax: Character tags, wildcards, seeded choices, immutable plans and paid-start rules. Call before preparing your first generation.",
  engui_list_wildcards: "List active wildcard keys and values in this workspace, with query/cursor/limit. Use returned keys in {key} prompts; never invent keys. No writes or default creation.",
  engui_get_context:
    "Inspect the fixed workspace, permissions and limits. No generation.",
  engui_list_models:
    "List supported image models and configured capabilities. Configured is not a health or quality guarantee. Only available=true models may be prepared/started. enabledByOwner is operator approval, configured is local setup, health=null is not a live GPU check. Only the owner can enable additional models.",
  engui_list_characters: "List active workspace characters.",
  engui_get_character:
    "Read character identity, editable traits/identityParts, editRevision, outfit options and reference summary. Optional characterVersionId reads a captured historical identity; historical reads have no editRevision. Outfit selection remains current; exact old generation settings are in the immutable plan.",
  engui_list_presets: "List visible outfits, active Vibes or model-compatible LoRAs. For full Vibe metadata, trash and revisions use engui_list_vibes / engui_get_vibe; author with Vibe tools. For Vibes, preferred=true marks an explicit workspace recommendation; otherwise the field is omitted. Nothing is automatically applied.",
  engui_search_gallery: "Search workspace Gallery images without enrichment. Filter bucket=draft/common/upscale and status=active (default) or trash. Returns full asset IDs, current bucket/status, source and editRevision. Use these revisions directly in engui_delete_gallery_assets; refresh after revision conflicts.",
  engui_get_gallery_asset: "Read current Gallery image metadata including trash, bucket (common means Added), original SHA-256, source and editRevision. No pixels or inference. Use after a move or receipt replay to observe current state; full assetId required.",
  engui_delete_gallery_asset: "Move an unwanted Gallery image to Trash, not permanent erasure. Requires curate, full assetId, fresh expectedRevision from engui_get_gallery_asset and UUID requestKey. Original file, Job, plan and provenance remain; the trashed Gallery source becomes unavailable for new generation/download. Retry same key/payload; restore explicitly with engui_restore_gallery_asset.",
  engui_restore_gallery_asset: "Restore a trashed Gallery image using its full assetId, fresh expectedRevision and UUID requestKey. Requires curate; no generation. Destination conflicts return GALLERY_DUPLICATE without deleting/merging records.",
  engui_get_image: "Inspect a bounded, resized WebP preview (512/1024px). NOT the full original; use engui_download_artifact to download original bytes.",
  engui_download_artifact: "Download the full original Job output or Gallery artifact, not a preview. Returns an HTTPS downloadUrl (GET, no additional headers required), filename, MIME, byteLength and SHA-256. Link expires in at most10minutes and is private bearer access to this exact file; do not publish it. Download with a file-capable HTTP client, preserve original bytes; never regenerate to get a download. Call again for a fresh expired link. Workspace read scope; no generation or Gallery write.",
  engui_prepare_generation:
    "Freeze exact prompts, optional inline Character references, settings and three seeds by default. characterId, characterVersionId and outfitId are not accepted. Plain text requires no Character; identities/outfits are inserted only by {character:UUID} and {character:UUID:withOutfit}. No implicit framing; framing/view/Vibe apply only when selected. Inspect snapshot.variants[].prompt and characterReferences (separate from wildcardReplacements). Read engui_get_prompt_guide. Local write only; never runs inference.",
  engui_get_plan: "Read an immutable plan and its existing batch.",
  engui_start_generation:
    "Start this exact prepared batch. Paid external operation: requires conversation authorization for this generation. Retry using the same requestKey.",
  engui_get_batch:
    "Read detailed Job-derived batch/variant status and phase. queued=local queue; provider_queued=accepted but NOT executing; running=confirmed execution; finalizing=output recovery. Inspect counts, statusMessage, isTerminal and cancellationRequested. lifecycleState is internal dispatch bookkeeping, NOT execution status. Stop normal execution polling when isTerminal=true; otherwise wait pollAfterSeconds. Unknown acceptance must never be blindly retried. Read-only; no provider calls.",
  engui_cancel_batch:
    "Cancel unwanted batch work. Fence queued variants; request cancellation of known provider jobs. Settled submission_unknown with no provider ID is stopped locally as abandoned, releasing the active slot while explicitly retaining unknown provider outcome. Active dispatch leases must settle first. Never retries inference. Poll engui_get_batch; locallyStoppedJobIds identifies local stops.",
  engui_delete_job: "Delete a finished Job or locally stop/delete settled submission_unknown work. Requires cancel scope. Active known-provider work must be cancelled first. Does not delete Gallery copies, immutable plans, variant tombstones or idempotency receipts; never generates. Retry with the same requestKey. Local deletion is not proof of remote cancellation.",
  engui_save_output:
    "Save original image bytes or move an existing saved image between draft and common (Added), retaining assetId, original bytes and provenance. Saving an already preserved Job output reuses its asset. Returns action created/moved/unchanged, previousBucket, current bucket/status and editRevision; no implicit copy or deletion of legacy duplicates. GALLERY_DUPLICATE identifies the existing destination; inspect before explicit cleanup. Requires curate; retry same requestKey/payload. Receipts are historical: read engui_get_gallery_asset for current state.",
  engui_record_concept_review:
    "Record shortlist/rejection or an explicitly owner-approved reference. Do not infer owner approval from an agent recommendation.",
  engui_get_concept_reference:
    "Read the approved reference and its stale/unavailable status.",
};
async function execute(
  name: ToolName,
  args: any,
  auth: Authority,
  origin: string,
): Promise<{ result: any; image?: any }> {
  switch (name) {
    case "engui_delete_jobs": return { result: await deleteJobs(auth, args) };
    case "engui_delete_gallery_assets": return { result: await deleteGalleryAssets(auth, args) };
    case "engui_get_gallery_asset": return { result: await getGalleryAsset(args.assetId) };
    case "engui_delete_gallery_asset": return { result: await changeGalleryTrash(auth, args, true) };
    case "engui_restore_gallery_asset": return { result: await changeGalleryTrash(auth, args, false) };
    case "engui_list_vibes": return { result: await listVibes(args) };
    case "engui_get_vibe": return { result: await getVibe(args.vibeId) };
    case "engui_create_vibe": return { result: await createVibe(auth, args) };
    case "engui_update_vibe": return { result: await changeVibe(auth, args, "update") };
    case "engui_delete_vibe": return { result: await changeVibe(auth, args, "delete") };
    case "engui_restore_vibe": return { result: await changeVibe(auth, args, "restore") };
    case "engui_create_upload": return { result: await createUpload(auth, args, origin) };
    case "engui_get_upload": return { result: await getUpload(auth, args.uploadId) };
    case "engui_create_character": return { result: await createCharacter(auth, args) };
    case "engui_update_character": return { result: await updateCharacter(auth, args) };
    case "engui_list_character_versions": return { result: await listCharacterVersions(args) };
    case "engui_get_outfit": return { result: await getOutfit(args.outfitId) };
    case "engui_create_outfit": return { result: await createOutfit(auth, args) };
    case "engui_update_outfit": return { result: await updateOutfit(auth, args) };
    case "engui_get_wardrobe": return { result: await getWardrobe(args) };
    case "engui_update_wardrobe": return { result: await updateWardrobe(auth, args) };
    case "engui_get_prompt_guide":
      return { result: { version: MCP_VERSION, uri: PROMPT_GUIDE_URI, markdown: PROMPT_GUIDE } };
    case "engui_list_wildcards":
      return { result: await listRecords("wildcards", args) };
    case "engui_get_context":
      return {
        result: {
          scopes: auth.scopes,
          serverVersion: MCP_VERSION,
          limits: limits(),
          operations: Object.keys(inputSchemas).filter((n) =>
            auth.scopes.includes(scopeFor(n as ToolName)),
          ),
        },
      };
    case "engui_list_models":
      return { result: { models: await listModels() } };
    case "engui_list_characters":
      return { result: await listRecords("characters", args) };
    case "engui_get_character":
      return { result: await characterDetail(args.characterId, args.characterVersionId) };
    case "engui_list_presets":
      return { result: await listRecords(args.kind, args) };
    case "engui_search_gallery":
      return { result: await listRecords("gallery", args) };
    case "engui_get_image": {
      const preview = await imagePreview(args.source, args.maxEdge);
      return { result: preview.metadata, image: preview.content };
    }
    case "engui_download_artifact":
      return { result: await downloadArtifact(auth, args.source, origin) };
    case "engui_prepare_generation":
      return { result: await prepareGeneration(auth, args) };
    case "engui_get_plan":
      return { result: await getPlan(args.planId) };
    case "engui_start_generation":
      return { result: await startGeneration(auth, args) };
    case "engui_get_batch":
      return { result: await getBatch(args.batchId) };
    case "engui_cancel_batch":
      return { result: await cancelBatch(args) };
    case "engui_delete_job":
      return { result: await deleteJob(args) };
    case "engui_save_output":
      return { result: await saveOutput(auth, args) };
    case "engui_record_concept_review":
      return { result: await recordReview(args) };
    case "engui_get_concept_reference":
      return { result: await getReference(args.characterId) };
  }
}
export function createMcpServer(auth: Authority, origin = "http://localhost") {
  const server = new McpServer(
    { name: "engui", version: MCP_VERSION },
    { capabilities: { tools: {}, resources: {} }, instructions: MCP_INSTRUCTIONS },
  );
  server.registerResource("prompt-guide", PROMPT_GUIDE_URI, { mimeType: "text/markdown", description: "Engui workflows, Character tags and wildcard syntax." }, async uri => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: PROMPT_GUIDE }] }));
  for (const name of Object.keys(inputSchemas) as ToolName[]) {
    const scope = scopeFor(name);
    if (!auth.scopes.includes(scope)) continue;
    server.registerTool(
      name,
      {
        description: descriptions[name],
        inputSchema: inputSchemas[name],
        outputSchema: z.object({
          schemaVersion: z.literal(1),
          workspace: z.object({ id: z.string(), name: z.string() }),
          result: outputSchemas[name],
        }),
        annotations: {
          readOnlyHint: scope === "read",
          destructiveHint: scope === "generate" || scope === "cancel" || ["engui_save_output", "engui_delete_gallery_asset", "engui_delete_gallery_assets", "engui_restore_gallery_asset", "engui_update_character", "engui_update_outfit", "engui_update_wardrobe", "engui_update_vibe", "engui_delete_vibe", "engui_restore_vibe"].includes(name),
          idempotentHint: true,
          openWorldHint:
            name === "engui_start_generation" || name === "engui_cancel_batch",
        },
      },
      async (raw: any) => {
        const started = Date.now();
        let status = "ok";
        const auditIds: Record<string, string> = {};
        for (const key of ["requestKey", "planId", "batchId", "vibeId", "assetId"])
          if (typeof raw[key] === "string") auditIds[key] = raw[key];
        try {
          // Repeat strict parsing so SDK coercion cannot silently drop unknown selectors.
          const args = inputSchemas[name].parse(raw);
          await rateLimit(auth, name);
          const action = () => execute(name, args, auth, origin);
          const value =
            scope === "read"
              ? await action()
              : await withWorkspaceActivity(
                  auth.workspace.id,
                  "mcp:" + name,
                  action,
                );
          for (const key of ["planId", "batchId", "jobId"])
            if (typeof value.result?.[key] === "string")
              auditIds[key] = value.result[key];
          const structuredContent = {
            schemaVersion: 1 as const,
            workspace: { id: auth.workspace.id, name: auth.workspace.name },
            result: outputSchemas[name].parse(value.result),
          };
          return {
            structuredContent,
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(structuredContent),
              },
              ...(value.image ? [value.image] : []),
            ],
          };
        } catch (error) {
          status = "error";
          const safe =
            error instanceof McpError
              ? {
                  code: error.code,
                  message: error.message,
                  retryable: error.retryable,
                  ...(error.details ? { details: error.details } : {}),
                }
              : error instanceof z.ZodError
                ? {
                    code: "INVALID_ARGUMENT",
                    message: "Invalid tool arguments.",
                    retryable: false,
                  }
                : error instanceof WorkspaceError
                  ? {
                      code: "WORKSPACE_UNAVAILABLE",
                      message: "Workspace or source is unavailable.",
                      retryable: false,
                    }
                  : {
                      code: "INTERNAL_ERROR",
                      message:
                        "The operation could not be completed. Read its status before retrying.",
                      retryable: false,
                    };
          return {
            isError: true,
            content: [{ type: "text" as const, text: JSON.stringify(safe) }],
          };
        } finally {
          console.info(
            "MCP audit",
            JSON.stringify({
              at: new Date().toISOString(),
              credentialId: auth.credentialId,
              workspaceId: auth.workspace.id,
              tool: name,
              status,
              ...auditIds,
              durationMs: Date.now() - started,
            }),
          );
        }
      },
    );
  }
  return server;
}
export async function handleMcpRequest(request: Request): Promise<Response> {
  if (process.env.ENGUI_MCP_ENABLED !== "1")
    return Response.json({ error: "Not found" }, { status: 404 });
  try {
    const auth = await authenticate(request);
    if (request.method !== "POST")
      return new Response(null, { status: 405, headers: { Allow: "POST" } });
    return await inAuthority(auth, async () => {
      const url = new URL(request.url);
      const origin = `${request.headers.get("x-forwarded-proto") === "https" ? "https:" : url.protocol}//${request.headers.get("host") || url.host}`;
      const server = createMcpServer(auth, origin),
        transport = new WebStandardStreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
          maxRequestBodySize: 128 * 1024,
        });
      await server.connect(transport);
      try {
        return await transport.handleRequest(request);
      } finally {
        await server.close();
      }
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    return Response.json(
      {
        error:
          error instanceof HttpError ? error.message : "MCP request failed.",
      },
      {
        status,
        headers:
          status === 401
            ? { "WWW-Authenticate": 'Bearer realm="engui-mcp"' }
            : undefined,
      },
    );
  }
}
