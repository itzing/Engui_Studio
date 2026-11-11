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
import { visibleParts } from "./authoring-schemas";
import { createCharacter, updateCharacter, listCharacterVersions, getOutfit, createOutfit, updateOutfit, getWardrobe, updateWardrobe } from "./authoring";
import { getPlan, prepareGeneration } from "./plans";
import { cancelBatch, getBatch, startGeneration } from "./batches";
import { getReference, recordReview, saveOutput } from "./curation";

const nullable = z.string().nullable(),
  json = z.record(z.unknown());
const list = z.object({ items: z.array(json), nextCursor: nullable });
const characterWrite = z.object({ characterId: z.string(), characterVersionId: nullable, editRevision: z.string(), changed: z.boolean() });
const outfitRead = z.object({ outfitId: z.string(), ownerCharacterId: nullable, name: z.string(), description: z.string(), constraints: z.string(), coversFace: z.boolean(), revision: z.number(), visibleParts: visibleParts.nullable() });
export const outputSchemas: Record<ToolName, z.ZodTypeAny> = {
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
  engui_list_models: z.object({
    models: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        modes: z.array(z.string()),
        configured: z.boolean(),
        health: z.null(),
        parameters: z.array(json),
        maxReferences: z.number(),
        maxLoras: z.number(),
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
    batchId: z.string(),
    planId: z.string(),
    state: z.string(),
    counts: z.object({
      total: z.number(),
      succeeded: z.number(),
      failed: z.number(),
    }),
    variants: z.array(json),
    provenance: json,
    pollAfterSeconds: z.number(),
  }),
  engui_cancel_batch: z.object({
    batchId: z.string(),
    cancellationRequested: z.boolean(),
  }),
  engui_save_output: z.object({
    assetId: z.string(),
    sha256: z.string(),
    bucket: z.string(),
    alreadySaved: z.boolean(),
  }),
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
  engui_create_character: "Create an ordinary workspace Character and its first identity version. Optional identityParts classify visible details by body region. Local write only; no generation. Reuse requestKey for retries.",
  engui_update_character: "Partially edit a character and append an identity version. Use editRevision from a fresh engui_get_character as expectedRevision. changes.traits merges keys; null deletes a key; omitted values/UI state are preserved. Identity changes clear old classification unless identityParts are supplied. Never generates; prepare a new plan after editing. Retry with the same requestKey.",
  engui_list_character_versions: "List immutable identity versions and traits, paginated by opaque cursor. identityComplete=false means historical name/gender were not captured; never invent them. Read a captured version with engui_get_character(characterVersionId).",
  engui_get_outfit: "Read an outfit, its visible parts and revision before editing. Workspace-scoped; no generation.",
  engui_create_outfit: "Create a workspace outfit or a personal outfit with ownerCharacterId. Personal outfits are linked to their owner, not automatically made default. visibleParts classify clothing by body region for cropped prompts. No generation.",
  engui_update_outfit: "Partially update an outfit using expectedRevision from engui_get_outfit. Omitted fields stay unchanged. Changed clothing text clears outdated classification unless visibleParts are supplied. Shared workspace outfits affect every character using them. No generation.",
  engui_get_wardrobe: "Read available outfits with linked/default flags and current character editRevision. Follow nextCursor for further outfits.",
  engui_update_wardrobe: "Link, select default, unlink or clear a character's default outfit using current editRevision as expectedRevision. clearDefault omits outfitId; other actions require it. Unlinking the default clears that selection, never deletes the outfit. No generation.",
  engui_get_context:
    "Inspect the fixed workspace, permissions and limits. No generation.",
  engui_list_models:
    "List supported image models and configured capabilities. Configured is not a health or quality guarantee.",
  engui_list_characters: "List active workspace characters.",
  engui_get_character:
    "Read character identity, editable traits/identityParts, editRevision, outfit options and reference summary. Optional characterVersionId reads a captured historical identity; historical reads have no editRevision. Outfit selection remains current; exact old generation settings are in the immutable plan.",
  engui_list_presets: "List visible outfits, Vibes or model-compatible LoRAs.",
  engui_search_gallery: "Search active workspace images without enrichment.",
  engui_get_image: "Inspect actual bounded image bytes, not just an image URL.",
  engui_prepare_generation:
    "Freeze exact prompts, references, settings and three seeds by default. Local write only; never runs inference.",
  engui_get_plan: "Read an immutable plan and its existing batch.",
  engui_start_generation:
    "Start this exact prepared batch. Paid external operation: requires conversation authorization for this generation. Retry using the same requestKey.",
  engui_get_batch:
    "Read durable batch status. Poll after the returned delay; never submits or retries generation.",
  engui_cancel_batch:
    "Fence queued variants and request cancellation of accepted jobs; cancellation is not proof of remote completion.",
  engui_save_output:
    "Preserve original image bytes in the workspace gallery without generation.",
  engui_record_concept_review:
    "Record shortlist/rejection or an explicitly owner-approved reference. Do not infer owner approval from an agent recommendation.",
  engui_get_concept_reference:
    "Read the approved reference and its stale/unavailable status.",
};
async function execute(
  name: ToolName,
  args: any,
  auth: Authority,
): Promise<{ result: any; image?: any }> {
  switch (name) {
    case "engui_create_character": return { result: await createCharacter(auth, args) };
    case "engui_update_character": return { result: await updateCharacter(auth, args) };
    case "engui_list_character_versions": return { result: await listCharacterVersions(args) };
    case "engui_get_outfit": return { result: await getOutfit(args.outfitId) };
    case "engui_create_outfit": return { result: await createOutfit(auth, args) };
    case "engui_update_outfit": return { result: await updateOutfit(auth, args) };
    case "engui_get_wardrobe": return { result: await getWardrobe(args) };
    case "engui_update_wardrobe": return { result: await updateWardrobe(auth, args) };
    case "engui_get_context":
      return {
        result: {
          scopes: auth.scopes,
          serverVersion: "1.1.0",
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
    case "engui_save_output":
      return { result: await saveOutput(args) };
    case "engui_record_concept_review":
      return { result: await recordReview(args) };
    case "engui_get_concept_reference":
      return { result: await getReference(args.characterId) };
  }
}
export function createMcpServer(auth: Authority) {
  const server = new McpServer(
    { name: "engui", version: "1.1.0" },
    { capabilities: { tools: {} } },
  );
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
          destructiveHint: scope === "generate" || scope === "cancel" || ["engui_update_character", "engui_update_outfit", "engui_update_wardrobe"].includes(name),
          idempotentHint: true,
          openWorldHint:
            name === "engui_start_generation" || name === "engui_cancel_batch",
        },
      },
      async (raw: any) => {
        const started = Date.now();
        let status = "ok";
        const auditIds: Record<string, string> = {};
        for (const key of ["requestKey", "planId", "batchId"])
          if (typeof raw[key] === "string") auditIds[key] = raw[key];
        try {
          // Repeat strict parsing so SDK coercion cannot silently drop unknown selectors.
          const args = inputSchemas[name].parse(raw);
          await rateLimit(auth, name);
          const action = () => execute(name, args, auth);
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
            structuredContent: safe,
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
      const server = createMcpServer(auth),
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
