# Engui MCP v1: workspace-bound character concepts

Status: v1 implemented under ENGUI-582 through ENGUI-586 on 2026-11-11; client connection setup explicitly excluded by owner14303. See [operations](engui-mcp-operations.md).
Date: 2026-11-11. Tracking: [ENGUI-581](../backlog/tasks/ENGUI-581.md).
Owner authorization: Telegram message 14297, following workspace-scoping discussion 14295.

## 1. Product goal and scope

Let an agent help produce fighting-game character concepts through Engui: inspect a character and references, prepare an exact generation, submit an authorized batch, inspect actual images, preserve candidates, and record the owner's chosen reference.

The product sequence is **concepts first, then drawn 2D sprites and combat-animation frames**. The first implementation covers concepts only. A successful concept is a reusable design reference, not a promise of consistent animation or an engine-ready sprite.

The initial client is OpenClaw, using a connection named `engui-showdown`. The server must remain usable by other compatible MCP clients. Showdown is configuration, never a hardcoded server workspace.

### In v1

- Workspace-bound connections and scoped credentials.
- Existing character descriptions/looks, outfits, Vibes and compatible LoRAs.
- Text-to-image concepts; reference-based iteration where the selected model supports it.
- Three variants by default, explicit seeds/settings, asynchronous jobs and actual image previews.
- Gallery preservation, candidate review and versioned owner-approved references.
- Existing Jobs/Gallery remain the ordinary place to see resulting jobs and images.

### Not in v1

- Sprite sheets, transparent-background guarantees, frame interpolation, combat timing, hitboxes, rigging or animation export.
- Video, audio, Studio Session runs, automatic large batches, model training or automatic endpoint provisioning.
- Workspace creation/deletion/switching tools, content transfer, global settings, arbitrary HTTP/SQL/shell tools or raw provider access.
- Character/wardrobe CRUD, arbitrary external-image downloads, new desktop/mobile screens or full application authentication migration.
- Automated visual approval, unbounded generate-until-good loops, or replacing the owner's chosen reference silently.

**Implementation authorized on 2026-11-11 (owner14303), tracked in ENGUI-582 through ENGUI-586.** Do not configure or connect OpenClaw or another agent as part of this task; validate transport using an isolated SDK test client instead. No paid generation is authorized for development or validation. No UI surface selection is needed for this backend-only scope; future UI additions require explicit desktop/mobile scope.

## 2. Verified baseline and gaps

Verified against source at `258d98a` on 2026-11-11, without provider generation:

| Existing component | Reuse / limitation |
| --- | --- |
| [Workspace route wrapper](../src/lib/workspaces/route.ts) | Reads `x-workspace-id`, query/body workspaceId; rejects mismatch, absence and non-active owners. |
| [Workspace context](../src/lib/workspaces/context.ts), [Prisma integration](../src/lib/prisma.ts) | Request-local scope and installed database guards. New MCP-owned models must join those guards. |
| [Generation submission](../src/lib/generation/submitFormData.ts) | Existing model routing, media handling, secure RunPod transport, local job creation and supervisor handoff. Not a complete idempotency layer. |
| [Model catalog](../src/lib/models/modelConfig.ts), [image policy](../src/lib/generation/imageModelPolicy.ts) | General catalog includes Krea2, Z-Image, Qwen Image Edit and Flux Krea. Character preview policy currently supports Krea2/Z-Image only. Catalog presence is not live provider readiness. |
| [Character look resolution](../src/app/api/characters/[id]/look/route.ts) | Existing look/compiler services can produce identity/outfit snapshots. `/characters/[id]` currently has PUT/PATCH, not a GET; do not invent a detail-read endpoint. |
| [Read-only status](../src/app/api/generate/status/route.ts) | Reads local job state. Existing supervisor owns provider polling and materialization. |
| [Gallery save](../src/app/api/gallery/assets/from-job-output/route.ts) | Saves source output and generation provenance; lookup-before-create is not sufficient for concurrent idempotency. |
| [Job cancellation](../src/app/api/jobs/[id]/cancel/route.ts) | Existing cancellation may delete a local job if its upstream record is gone. MCP needs a preserved operation receipt. |
| [Workspace isolation specification](workspace-isolation-spec.md) | Explicitly shared Default-owned LoRAs are an allowed exception; no other cross-workspace content sharing is implied. |

The current application owner is `user-with-settings`; that is not a remote caller authentication mechanism. MCP must authenticate independently and map the verified token to this existing owner server-side. Never accept a caller-provided userId.

New work includes the MCP endpoint/adapters, scoped token administration, generation plans/batches, durable dispatch/idempotency, scoped image delivery, and approved-reference records. None exists merely because analogous REST routes exist.

## 3. Architecture and transport decision

### Options considered

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| MCP endpoint inside Engui's Node backend | Shares guarded services/database, atomic records, one deployment | Requires a verified SDK-to-Next request adapter | **v1** |
| Separate HTTP sidecar calling Engui REST | Independent process lifecycle | Additional authenticated internal API and split durable state | Defer unless endpoint integration is proven unsuitable |
| stdio-only local adapter | Simple local process binding | Not the requested header-based HTTP connection model | Optional future client adapter |

Implement `POST /api/mcp` using the official MCP TypeScript SDK, a pinned version, Node runtime and a thin transport adapter. Verify initialization, tool calls and image content with the chosen SDK before building domain features. Reuse Engui domain services; extract them from REST handlers where necessary. Do not issue loopback HTTP calls to Engui merely to reuse a handler, and do not duplicate provider submission logic.

**v1 uses stateless Streamable HTTP.** Every request carries authentication and workspace headers; no shared mutable selected-workspace variable and no MCP server session ID are required. Plans, batches and review revisions are durable domain state, independent of transport connections. Support initialize, initialized notification, ping, tools/list and tools/call through the SDK. Advertise only implemented capabilities. No server-initiated sampling, elicitation, roots, subscriptions or MCP Tasks capability in v1.

Respond using standard JSON or SSE framing negotiated by the SDK. With no standalone event stream or stateful session, GET/DELETE return the protocol-appropriate unsupported-method response. Authenticate notifications too; honor negotiated protocol-version headers. An MCP request ID is not an idempotency key. Reconnection must not replay a mutation implicitly.

Use bounded JSON response completion for the initial tool set; no long-lived SSE stream is needed to wait for a generation. The asynchronous batch contract owns long work.

A future stateful transport must bind its session to token identity + workspace ID and revalidate both on every request; a session ID is never authorization.

### Deployment boundary

- Serve through the existing private Engui origin; TLS is required outside literal loopback.
- Apply configured host/origin validation; no wildcard credentialed CORS. Native clients without Origin are permitted with valid credentials.
- MCP bearer authorization applies only to the MCP surface and its authenticated media-download route, not to unrelated legacy REST routes.
- Preserve existing UI behavior. This project does not turn legacy public/static media URLs into private storage; do not claim installation-wide multi-tenant security.

## 4. Workspace-bound connection and authentication

Each client connection has one stable workspace UUID. Renaming a workspace does not change its identity. Browser-selected workspace, cookies, previous requests and Default are not selection sources for MCP.

```http
Authorization: Bearer <workspace-scoped-token>
X-Workspace-Id: <workspace-uuid>
```

Both are required on **every request**, including discovery and any media download. UUIDs select scope; possession of a UUID grants no access. Header names are case-insensitive. Reject blank/duplicate/ambiguous selector values and any attempt to add workspaceId/userId through tool arguments or URL query parameters.

For v1, one credential is bound to exactly one workspace. To use another workspace, configure another named connection and credential. Do not expose `select_workspace` or `set_workspace`. A changed header with the same token is rejected even though the transport is stateless.

### Credential contract

- Provision/revoke credentials through an operator-only local CLI; no new token-management UI in v1.
- Store a public token ID, hash of a cryptographically random secret (at least 256 bits), workspaceId, ownerId, scopes, expiry and revokedAt. Never persist the plaintext token.
- Display/export the secret only during explicit provisioning; never put it into source, audit logs, tool output or prompts.
- Scopes: `read`, `generate`, `curate`, `cancel`. Each token includes `read`; mutation scopes are explicit.
- `generate` covers preparation, submission and the exact authorized variant count; it does not authorize autonomous repeated attempts. `curate` covers saving and review records. `cancel` is limited to MCP-created batches in this workspace in v1.
- Recheck revocation, expiry, allowed workspace and lifecycle on each request. Recheck generation authority before each not-yet-dispatched variant. Revocation stops new dispatch; already accepted provider jobs remain owned by Engui and continue to settle unless explicitly cancelled.
- Header/workspace mismatch:403. Missing/invalid/expired/revoked credential:401 with Bearer challenge. Authenticated missing workspace:400. Unknown/foreign workspace:404 without revealing its contents. Deleting workspace:409.
- Establish a fresh workspace AsyncLocalStorage context per request/tool operation. Never cache content by object ID alone; include workspace and relevant content revision.

Do not export global provider credentials, endpoint IDs, filesystem paths, account balances or other-workspace counts in MCP responses.

### OpenClaw connection example

Illustrative configuration; this endpoint is not deployed by this specification. The Authorization placeholder must be replaced using the installed client's supported secret-reference mechanism, not committed as a literal secret.

```json
{
  "mcp": {
    "servers": {
      "engui-showdown": {
        "url": "https://<engui-private-host>/api/mcp",
        "transport": "streamable-http",
        "enabled": true,
        "connectionTimeoutMs": 10000,
        "requestTimeoutMs": 30000,
        "headers": {
          "Authorization": "<secret-managed Bearer header>",
          "X-Workspace-Id": "<Showdown workspace UUID>"
        }
      }
    }
  }
}
```

Use a second definition, such as `engui-default`, for another workspace. Verify the chosen OpenClaw/Codex runtime forwards headers during initialization and actual tool calls. Do not enable OAuth mode while expecting static Bearer headers; OAuth is not part of v1. Future stdio uses equivalent fixed per-process configuration such as ENGUI_WORKSPACE_ID and a credential, not a workspace tool argument.

## 5. Tools and bounded contracts

Use names below as the v1 API contract. All tool inputs are strict objects with `additionalProperties: false`; nested objects are strict too. Every successful response includes `workspace: {id, name}` and `schemaVersion: 1`. Typed output schemas and MCP structuredContent are authoritative; provide a compact text summary for clients without structured rendering. All generated descriptions and errors are English.

Common types:

- `Id`: nonempty opaque application ID; validate format/length and ownership, not just existence.
- `Page`: `{cursor?: string, limit?: integer}`; default 20, maximum 50. Cursor is opaque and workspace/filter-bound.
- `MediaRef`: `{kind: "gallery_asset", assetId: Id}` OR `{kind: "job_output", jobId: Id, outputId: Id}`. Never a caller URL, local path, data URI or arbitrary object key.
- `RequestKey`: client-generated UUID, supplied unchanged on retries.
- `Revision`: nonnegative integer used for optimistic concurrency.
- Free text: max 16000 characters per prompt; query max 256; review notes max 2000. No unbounded nested JSON parameters.

| Tool | Input | Main result | Scope / effects |
| --- | --- | --- | --- |
| `engui_get_context` | `{}` | Workspace, scopes, server version, limits, enabled operations | read; no inference |
| `engui_list_models` | `{}` | Image-model IDs, supported modes, parameter schemas/defaults, configured flag, optional timestamped health | read; no model warm-up |
| `engui_list_characters` | `{query?, ...Page}` | IDs, names, version/revision, compact summaries | read |
| `engui_get_character` | `{characterId}` | Normalized identity, outfit options, current version, existing concept-reference summary | read; new service-level detail adapter |
| `engui_list_presets` | `{kind: "outfits" | "vibes" | "loras", characterId?, modelId?, query?, ...Page}` | Visible compatible records, IDs and descriptions; explicit shared-LoRA provenance | read |
| `engui_search_gallery` | `{query?, favoritesOnly?: boolean, ...Page}` | Active image assets and compact generation metadata | read; no enrichment/thumbnail generation as a side effect |
| `engui_get_image` | `{source: MediaRef, maxEdge?: 512 | 1024}` | Actual MCP image content + dimensions/hash/source metadata | read; bounded preview only |
| `engui_prepare_generation` | GenerationDraft below + requestKey | Immutable plan, fully resolved per-variant prompts/settings/seeds, digest, warnings, expiry | generate; local plan write, **no provider work** |
| `engui_get_plan` | `{planId}` | Original plan and any existing batch link | read |
| `engui_start_generation` | `{planId, planDigest, requestKey}` | Durable batchId and variant/job IDs | generate; starts only the prepared bounded batch |
| `engui_get_batch` | `{batchId}` | Per-variant states, results, errors and provenance | read; never submits or retries |
| `engui_cancel_batch` | `{batchId, requestKey}` | Cancellation request receipt and per-variant outcomes | cancel; does not delete historical media |
| `engui_save_output` | `{source: MediaRef, bucket?: "common" | "draft", requestKey}` | Durable gallery asset ID, hash and alreadySaved | curate; no generation |
| `engui_record_concept_review` | `{characterId, assetId, snapshotPlanId?, decision: "shortlisted" | "rejected" | "approved", expectedRevision, notes?, requestKey}` | Review record and current reference revision | curate; explicit owner decision for approved |
| `engui_get_concept_reference` | `{characterId}` | Current approved reference, snapshot, revision, stale/missing-source status | read |

Tool annotations must reflect real effects: prepare is not read-only because it persists a plan; generation is a paid external mutation; cancellation is not read-only. Idempotent hints are supplied only for tools with enforced persistent idempotency, not merely an intention. Annotations do not replace authorization.

Lists never expose trashed/deleted content by default. The agent can inspect a saved asset after source-job retention cleanup. get_image must return actual image bytes or a clear error, not just a URL represented as a successful visual inspection.

### GenerationDraft

```ts
type GenerationDraft = {
  characterId: string;
  characterVersionId?: string;
  parentBatchId?: string;
  mode: "text_to_image" | "image_to_image" | "image_edit";
  modelId: "krea2-turbo" | "z-image" | "qwen-image-edit";
  prompt: string;
  negativePrompt?: string;
  framing?: "full_body" | "portrait" | "custom";
  view?: "front" | "three_quarter" | "side" | "custom";
  outfitId?: string;
  vibeId?: string;
  references?: MediaRef[];
  width?: number;
  height?: number;
  variantCount?: 1 | 2 | 3;
  seeds?: number[];
  parameters?: { steps?: number; cfg?: number; guidance?: number; denoise?: number };
  loras?: Array<{ id: string; weight: number }>;
  requestKey: string;
};
```

- Default: full_body, 1024x1024, three variants. Do not invent an art style or camera angle that the owner has not chosen; leave view unspecified if absent and show the resulting prompt in preparation.
- Use current registry bounds/multiples and per-model parameter allowlists; expose them in list_models. Reject unsupported fields rather than silently ignoring them.
- Krea2: text_to_image, no image references. Z-Image: text_to_image or image_to_image with exactly one init image. Qwen: image_edit with one or two references. Z-Image pose conditioning is deferred from the mandatory v1 contract; advertise it only after an explicit tested extension.
- No image reference may be accepted by a text-only route with an implied identity-preservation promise. Character text can inform Krea2, but an image cannot condition its current text-only adapter.
- LoRA selection is bounded to at most 8 records and only models with tested LoRA support; Qwen rejects LoRAs in v1. Z-Image text_to_image rejects image references. Array/reference/parameter limits are enforced before any side effects.
- The selected model must be configured and supported by the chosen adapter. Configuration and optional health checks do not prove quality or successful generation. Flux Krea and upscale are not mandatory v1 tools.
- If seeds are omitted, generate and persist distinct supported-range seeds during preparation. Supplied seeds must match variantCount; reject duplicate seeds for a multi-variant comparison. Submission never randomizes them again.
- Default three seeds reflects the existing art workflow. Smaller counts require an explicit caller value; no automatic expansion or extra retry generations.
- Snapshot the selected character version AND resolved look/outfit contents; a version ID alone does not capture all wardrobe edits.
- Return the exact final prompt and effective settings for every variant. Preserve base prompt, identity/outfit composition, Vibe source and any wildcard/variant resolution separately.
- The existing submit path expands Vibes/wildcards. Extract/share deterministic prompt resolution and provide an internal trusted prepared-payload path so a prepared prompt is not expanded twice. Do not add a public flag allowing arbitrary callers to bypass validation.
- Plans expire 24 hours after preparation if not started. Revalidate lifecycle, source visibility, model mapping, character/look digest and LoRA visibility before accepting and dispatching. Changes return PLAN_STALE; do not silently recompute the plan.
- estimatedCost is nullable with explicit unknown status; no fabricated quote or hard dollar-budget guarantee. Exact model/count/dimensions/steps remain reviewable even when provider cost is unavailable.

## 6. Generation lifecycle, retries and concurrency

### Durable acceptance

Preparation records a plan only: no uploads, helper inference, source materialization jobs, endpoint wake-up or RunPod request. Prompt construction uses existing deterministic compilers, not an automatic LLM helper.

start_generation must transactionally validate the immutable digest, reserve one batch for the plan, allocate ordered variant IDs and planned local job IDs, and persist dispatch records. It returns after local acceptance, not after image generation. Target under 5 seconds under normal local load; respect the client's 30-second request timeout without tying a provider run to an HTTP connection.

A durable application worker dispatches one not-yet-started variant at a time per workspace by default. Use leases/atomic state transitions across overlapping requests and process restarts; no in-memory-only queue. The worker establishes workspace context, activity/LoRA pins and current token/lifecycle authority for each variant. Existing RunPod supervision owns remote polling, downloads and completion after a confirmed provider receipt.

Do not pre-create a Job then call a helper that unconditionally creates the same Job. Adapt the existing submission service deliberately around the allocated ID and durable dispatch record, retaining the normal UI submission contract.

### Idempotency invariants

- Unique preparation key: workspace + operation + requestKey. Same normalized input returns the same plan; different input yields IDEMPOTENCY_CONFLICT.
- Unique submission: one batch per plan, plus unique workspace + start requestKey. Same plan cannot launch twice even with a new request key. A new intended attempt requires a new plan, optionally linked by parentBatchId.
- Allocate one stable local job ID and one dispatch identity per variant. Concurrent identical calls cannot create additional variants or provider submissions.
- Persist deduplication receipts/tombstones while a token can reference an operation; pruning must return an expired/retired result, never reinterpret an old key as a new paid action.
- Cancellation, gallery save and review writes also have durable request-key semantics. Gallery membership uses an atomic unique source/bucket constraint, not only lookup-before-create. Migrating that constraint requires reconciling existing duplicates without deleting source media.

### Ambiguous upstream acceptance

Exactly-once execution cannot be promised across an external provider boundary without provider-supported deduplication. Existing submission marks general errors failed and may lose the distinction between rejection and lost acceptance. MCP implementation must preserve this distinction.

Persist a submitting state before crossing the provider boundary. If a timeout, crash or lost acknowledgement leaves acceptance unknown, mark the variant `submission_unknown`, stop further dispatch for that batch, and reconcile available local/provider attempt evidence. **Never automatically call submit again** for that uncertain variant, including after worker restart or a repeated tool call.

A confirmed rejection before acceptance may be terminal failed. A recorded provider job can be polled using the existing supervisor. An unresolved unknown remains visible for operator investigation. Starting a replacement is a new explicitly requested plan, not a hidden retry. A restarted worker may resume undispatched variants only after the batch has no ambiguous submission and authority/lifecycle remain valid.

### States and results

Variant states: prepared, queued, submitting, submission_unknown, running, succeeded, failed, cancel_requested, cancelled. Keep raw provider status as optional diagnostic metadata, not the public state machine. Distinguish a requested cancellation from an observed terminal cancellation.

Batch states: queued, running, needs_attention, completed, partial, failed, cancel_requested, cancelled. submission_unknown yields needs_attention and is not terminal failure proof. Batch result includes batchId, planId, counts and ordered variants; mixed success is `partial`, not success for all. Include stable variant label A/B/C, local jobId, outputId, media reference, seed, model and sanitized failure code. HTTP transport cancellation/disconnection does not cancel accepted generation. No hidden retry, automatic model fallback or extra variants.

cancel_batch first fences undispatched variants and then requests cancellation for accepted jobs. If completion races cancellation, keep the actual completed result and report it. Repeating cancellation is safe. Adapt existing cancel logic so MCP batch receipts survive local job removal; cancelling must not delete saved gallery copies or unrelated jobs.

## 7. Image inspection, reference ownership and provenance

- Accept only same-workspace gallery/job-output IDs. Resolve and verify ownership of the complete object chain and bytes, including inputs, previews, downloads and repeated reads.
- The only cross-workspace library exception is an explicitly shared Default LoRA, validated by existing LoRA visibility/pinning rules. It does not grant access to Default's images or characters.
- Source references are ID-based; verify MIME, decodeability, size and hash. Source-reference limits: at most 2 images, max 25MiB each and 40 megapixels decoded. Reject unsupported content rather than falling back to an arbitrary URL fetch.
- get_image returns a downscaled real image at 512px by default, at most 1024px and 1MiB encoded, plus original dimensions/hash. A comparison uses individually identified images, with the reference first and variants A/B/C after it. Never modify the saved original to create a preview.
- If original-byte download is exposed, use an authenticated workspace-bound `/api/mcp/media/...` route with range/size handling; it shares token checks and returns no embedded credentials. No raw filesystem paths or provider signed URLs in tool output.
- Standard Engui UI links may be returned for navigation, but must be labeled as links, not image inspection. Existing static originals remain subject to the existing application's exposure model.
- No arbitrary URL import or file-upload tool in v1. Upload external references through the existing Engui workspace UI, then select their IDs. A future import tool needs its own bounded transfer/ownership contract.
- Retain exact original PNG/image bytes, prompt stages, model/mode, effective seed/settings, source hashes, character/look snapshot, selected LoRAs/Vibe, parent plan/batch, timestamps and job/output identifiers.
- Successful variants are automatically preserved in the workspace Draft gallery as part of the accepted batch, using the atomic save service. This retains every original across ordinary job-retention cleanup. Report preservationState separately from generation state; archival failure can retry local saving, never paid generation. Return the durable assetId once ready. Explicit owner trash/deletion remains respected. save_output can add the selected draft asset to the Common gallery idempotently without deleting the draft or changing original bytes.
- Embedded PNG workflow metadata is preserved when supplied, but server-side provenance is canonical when a provider does not embed a workflow. Reproducible inputs do not guarantee byte-identical images across provider/model upgrades.
- Never send credentials, secure transport envelopes, raw job options, internal endpoint IDs or another workspace's source metadata in a result.

## 8. Candidate review and approved references

Shortlisting is not owner approval. The agent may offer a recommendation but must not record `approved` without an explicit owner choice. No new mandatory confirmation UI or second approval ceremony is introduced; the MCP client follows the conversation's authorization. A caller-supplied approval string is not cryptographic evidence of human consent.

Review operates on a durable GalleryAsset. Save a job output before approving it so the reference survives job-retention cleanup. record_concept_review verifies character and asset ownership and binds the decision to the relevant character/look snapshot. For an MCP-generated asset, use its persisted generation snapshot. For an existing gallery asset without that association, require snapshotPlanId: an unexpired, same-workspace prepared plan for this character that explicitly includes this asset as a reference. This binds the current verified look snapshot without starting that plan. Reject missing or contradictory associations; never infer the character from a filename.

Maintain an append-only review history and one current approved reference per character. Replacing it requires the expected current reference revision (zero if none); concurrent changes yield REVISION_CONFLICT. Retry returns the original receipt. Do not overwrite character identity, default outfit, earlier references or media bytes.

A later character/look edit marks the old approval stale rather than erasing or silently updating it. get_concept_reference reports the snapshot mismatch. A missing/trashed source is unavailable, never substituted. Preparing from an old snapshot requires that snapshot to be explicitly selected and still valid; approval does not grant access to a deleted/private source.

## 9. Persistence and workspace lifecycle

Additive logical entities; exact Prisma names may follow repository conventions:

| Entity | Required state |
| --- | --- |
| McpCredential | Token ID/hash, owner/workspace, scopes, expiry/revocation; no plaintext secret |
| McpGenerationPlan | Workspace, creator credential, request key/input digest, immutable snapshot/plan digest, expiry, optional parent |
| McpGenerationBatch | One per plan, start key, acceptance receipt, cancellation fence, state/revision |
| McpGenerationVariant | Workspace/batch/index, planned job ID, dispatch identity, snapshot, lease/state, provider acceptance evidence |
| CharacterConceptReview / Reference | Workspace/character/asset/snapshot, decision/history, current reference revision |
| McpOperationReceipt | Workspace/op/key/input digest/result identity; durable deduplication and retired-key behavior |

All content rows participate in workspace guards and deletion manifests. Foreign keys and unique indexes must express scope and idempotency; where both parent/child carry workspace IDs, enforce equality. Workers must not bypass guards through an unscoped Prisma client. Credential authentication uses a dedicated narrow lookup before establishing content scope.

Deleting a workspace revokes its tokens, rejects requests, fences dispatch, drains/cancels accepted work through the existing deletion machinery and cleans new owned records/resources. No late worker recreates deleted content. Cleanup must not remove shared Default LoRAs. Preserve operational tombstones without retaining erased prompt/image content. Do not cascade away active dispatch evidence before external cleanup settles.

Token revocation differs from workspace deletion: it stops new authorized work but is not permission to erase historical images. Renaming has no effect on ownership. Concurrent Showdown and Default requests use independent scopes; no process-global current workspace.

## 10. Errors, limits and observability

Transport authentication/protocol errors use the appropriate HTTP/JSON-RPC mechanism. Domain tool failures use MCP `isError: true` with a structured `{code, message, retryable, operationId?, details?}` envelope and a safe text summary. Do not report a failed generation as a successful tool result containing only an error string.

Required domain codes: WORKSPACE_UNAVAILABLE, FORBIDDEN_REFERENCE, NOT_FOUND, MODEL_NOT_CONFIGURED, UNSUPPORTED_MODE, INVALID_ARGUMENT, PLAN_STALE, PLAN_EXPIRED, IDEMPOTENCY_CONFLICT, SUBMISSION_UNKNOWN, PROVIDER_REJECTED, MEDIA_UNAVAILABLE, SNAPSHOT_ASSOCIATION_REQUIRED, REVISION_CONFLICT, RATE_LIMITED. Never disclose whether a foreign object's ID exists; use a uniform not-found/forbidden response without its details.

Defaults: request body max 128KiB excluding authenticated media downloads; list page 20/max 50; maximum 3 variants/plan; one active dispatch lane/workspace; at most 2 nonterminal batches/workspace; prepare/start 10 calls/minute/credential and other tools 120/minute/credential. Return rate-limit retry hints and do not accept additional hidden work. Make limits operator-configurable and report effective limits in get_context.

Read polling is bounded: client backoff from 2 seconds to 10 seconds, respects retry hints and stops at terminal state. Existing supervisor polling remains authoritative. get_batch has no provider-submission side effects.

Audit: timestamp, request/operation ID, token public ID, workspace ID, tool, plan/batch/job identity, status and duration. Redact Bearer tokens, provider secrets, raw image data and prompt bodies from general logs. Store prompt provenance only in scoped records. Record actual measured costs when available; null means unknown, not zero.

## 11. End-to-end usage

1. Operator provisions a Showdown-scoped credential and configures engui-showdown with its fixed workspace header.
2. Agent calls get_context, lists characters/models, reads the chosen character and existing approved reference.
3. Owner supplies/chooses style and goal. Agent prepares a plan; user can review three exact variants, inputs/settings and any unsupported requests before paid submission.
4. When the conversation already authorizes this exact generation, start it without another redundant confirmation. Preparation alone is not authorization. A plan/digest is a reproducibility mechanism, not permission to spend.
5. Agent polls get_batch and uses get_image to inspect completed results. It reports partial failures honestly and never retries a paid submission blindly.
6. Results are presented reference-first and numbered A/B/C; exact originals/settings remain preserved.
7. Owner chooses a candidate. Agent saves it and records approval; future iterations use its stable asset and snapshot.

Do not assume a chat attachment is automatically available as an Engui reference. If it is not already in this workspace, use the existing upload path before preparation.

## 12. Acceptance and regression matrix

Automated verification uses synthetic data, local image fixtures and a mock provider. All paid model/helper/Studio Session calls are disabled. Read-only production discovery is allowed; any actual generation needs a separate explicit owner authorization.

- **Protocol:** official MCP client initializes, discovers typed tools, calls read/write tools, handles errors and renders actual image content; An isolated SDK client forwards headers for initialization and subsequent calls; real OpenClaw/Codex connection testing is excluded by owner14303. SDK version pinned. No unsupported capability advertised.
- **Authentication:** missing/invalid/expired/revoked credentials fail; secrets absent from logs/output; read-only token cannot prepare/start/curate/cancel; swapping header cannot change credential scope.
- **Isolation:** concurrent A/B operations, every direct-ID access, job output, gallery byte read and review reject cross-workspace references; unknown inputs cannot inject workspace/user/endpoint IDs. No fallback to Default. Shared Default LoRA works only while explicitly visible.
- **Lifecycle:** deletion/revocation between prepare/start/dispatch blocks new work; late completion cannot recreate a deleted workspace; rename is harmless; pending receipts survive restart.
- **Models:** correct text-only versus reference capabilities; Qwen one/two-image validation; Z-Image init-image route; unsupported parameters rejected; configured does not falsely mean healthy; paused/unavailable endpoint reported.
- **Preparation:** three distinct persisted seeds, frozen character/outfit/Vibe/LoRA/reference hashes, exact per-variant prompts, no duplicate Vibe/wildcard expansion; zero provider/helper/upload activity.
- **Idempotency:** simultaneous repeated prepare/start/save/review calls, same-key changed payload, different start key for the same plan, response loss, expired plan and retired receipt. Exactly one local batch and no duplicate dispatch.
- **Crash boundaries:** before provider call, during call, after acceptance before local receipt, after local receipt, before completion import. Ambiguous states never auto-resubmit. Test worker lease races and process restart.
- **Jobs:** three outputs or accurate partial failure, no silent fallback/fourth variant; disconnect does not cancel; user cancellation fences queued work and reports terminal outcomes; historical gallery copies remain intact.
- **Media/review:** actual preview bytes and hashes; limits/invalid image/path/URL rejection; source job cleanup does not break saved approval; optimistic review conflict; changed character marks approval stale; no automatic approval.
- **Existing UI:** generation, character previews, gallery save and cancellation retain current contracts on desktop/mobile. Focused service regression checks are required for extracted services; no new UI is introduced.
- **Operations:** production build, service health, read-only MCP smoke, token revoke and disable/rollback rehearse successfully. No live generation is smuggled into smoke tests.

## 13. Implementation sequence and rollout

Create local backlog implementation tickets only after the owner authorizes implementation. Suggested bounded slices:

1. SDK/Next transport spike with mock tools, token administration, fixed workspace context and read-only get_context. Prove SDK client compatibility in isolation before adding mutations; do not connect OpenClaw in this implementation task.
2. Scoped character/library/gallery adapters and actual image delivery; map all ownership checks, shared-LoRA exception and media limits.
3. Persisted immutable plans and shared deterministic prompt/model/reference resolution. No paid operations yet.
4. Durable batches/dispatch, provider acceptance reconciliation, cancellation, supervisor integration and mocked crash/idempotency tests.
5. Atomic gallery preservation, review history and approved-reference versioning; finalize contract docs and example client config.
6. Integration/regression checks, additive migration on a copied database, production build and deployment. Leave client connections unconfigured; provide operator instructions for a future separately requested connection. Live image trial remains separately owner-authorized.

Rollout behind `ENGUI_MCP_ENABLED`, default false. Back up SQLite consistently and retain the previous production build before schema/runtime changes. No workspace/media backfill or relocation is required for this feature; new records are additive. Review cleanup/index migrations separately, especially existing gallery duplicates.

Rollback: disable MCP admission and revoke credentials; fence queued dispatch and inspect in-flight/unknown acceptance before stopping its worker. Preserve provider supervision for already accepted jobs. Keep additive tables and receipts for reconciliation; do not drop them or restore an older database over accepted paid jobs. Restore the previous build only after new dispatch is quiescent and outstanding jobs have a supported supervisor. Never delete generated originals as a rollback step.

## 14. Decisions still belonging to art production

The transport and workspace-binding decisions are settled for this specification. Exact art style, first fighter, game camera, target sprite dimensions, palette restrictions and animation frame conventions are not yet selected. They are not blockers for implementing the concept MCP and must not be invented as application defaults. Sprite/animation tooling will receive a separate specification after a concept-to-key-pose trial establishes feasibility.


## Implemented authoring extension

ENGUI-589 extends the initial 15-tool scope to 23 tools, adding character creation/partial editing, version reads and outfit/wardrobe authoring. See [the authoring contract](engui-mcp-character-authoring.md). This closes the create/generate/review/edit/regenerate loop without adding a concept UI entity.
