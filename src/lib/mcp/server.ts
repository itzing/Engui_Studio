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
import { getPlan, prepareGeneration } from "./plans";
import { cancelBatch, getBatch, startGeneration } from "./batches";
import { getReference, recordReview, saveOutput } from "./curation";

const nullable = z.string().nullable(),
  json = z.record(z.unknown());
const list = z.object({ items: z.array(json), nextCursor: nullable });
export const outputSchemas: Record<ToolName, z.ZodTypeAny> = {
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
  engui_get_context:
    "Inspect the fixed workspace, permissions and limits. No generation.",
  engui_list_models:
    "List supported image models and configured capabilities. Configured is not a health or quality guarantee.",
  engui_list_characters: "List active workspace characters.",
  engui_get_character:
    "Read character identity, outfit options and reference summary.",
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
    case "engui_get_context":
      return {
        result: {
          scopes: auth.scopes,
          serverVersion: "1.0.0",
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
      return { result: await characterDetail(args.characterId) };
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
    { name: "engui", version: "1.0.0" },
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
          destructiveHint: scope === "generate" || scope === "cancel",
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
