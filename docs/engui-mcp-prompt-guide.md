# Engui MCP prompt guide

## Start here
1. Call engui_get_context to verify the fixed workspace and permissions. Use engui_list_models, engui_list_characters, engui_get_character and engui_list_presets to discover real IDs; never invent IDs or infer model health from configured=true.
2. Edit Character cards and default outfits with authoring tools when the owner requests lasting changes. Use a fresh editRevision/expectedRevision and UUID requestKey. Omitted fields are preserved; null removes a trait. Read again after revision conflicts.
3. Call engui_prepare_generation. It freezes exact prompts, references, settings and seeds (three variants by default) WITHOUT paid inference. Inspect snapshot.variants and warnings.
4. Call engui_start_generation only with conversation authorization for this paid generation, the exact planId/planDigest and a UUID requestKey. Retry the SAME operation with the SAME key and payload. Poll engui_get_batch using pollAfterSeconds; never blindly resubmit uncertain work.
5. Review actual images with engui_get_image. Completed originals are preserved to Draft. Record an approved reference only after the owner selects it.

## Batch status and polling
engui_get_batch is read-only and uses the latest locally stored Job status; it never polls the provider itself or submits/retries work. observedAt is the time of this read, NOT the timestamp of a fresh provider response. Supervisor polling can lag provider transitions.
- queued: local Engui dispatch queue; not yet sent.
- submitting: preparing/sending the provider request; execution not confirmed.
- provider_queued: provider queue (Job queued/in_queue); NOT running inference.
- running: Job processing/in_progress/running confirms execution.
- finalizing: inference finished; retrieving/recovering the output, not another generation.
- awaiting_status: missing/unknown Job state; neither execution nor failure is confirmed. Do not guess or resubmit.
- submission_unknown: acceptance uncertain; requires reconciliation, never blind retry. Remaining queued variants are blocked with blockedReason=SUBMISSION_UNKNOWN.
- cancel_requested: cancellation is requested, not confirmed. phase preserves the last known execution stage; keep polling. Terminal results can still succeed after a cancellation request.
- abandoned: stopped locally after uncertain submission with no provider ID; terminal locally, slot released, but provider outcome is UNKNOWN. This is not confirmed remote cancellation.
- succeeded / failed / cancelled: terminal variant outcomes. Batch completed means all succeeded; partial means some succeeded and the rest failed/cancelled; needs_attention means uncertain submission.
The batch state summarizes remaining work: attention first, then cancellation, running, finalizing, submitting, provider_queued, awaiting_status, queued, blocked. Always inspect variants and counts for mixed batches. Completed siblings do not make a queued batch running.
counts contains mutually exclusive per-state counts (camelCase names such as providerQueued and submissionUnknown); they sum to total. No invented queue position, ETA or inference percentage is supplied. lifecycleState is internal dispatch bookkeeping retained for diagnostics/compatibility: its running means accepted/in flight, NOT confirmed inference. Use state and phase instead. jobStatus exposes only the stored raw status, not provider secrets.
When isTerminal=false, wait pollAfterSeconds before polling again. When isTerminal=true, pollAfterSeconds=0 means STOP ordinary execution polling, not immediate retry. Gallery preservation is separate: succeeded can temporarily have preservationState pending/failed; inspect assetId/preservationState or use engui_save_output, never regenerate to obtain a gallery copy.

## Concurrency, cancellation and deletion
limits.activeBatches (default 2, configurable by the operator) is Engui's per-workspace concurrency guard for paid batch starts, NOT a Qwen/RunPod limit. Queued, executing and unresolved submissions count as active; terminal abandoned work does not. Never bypass the cap by creating duplicate plans/batches.
Use engui_cancel_batch for unwanted work. It fences unsent variants and requests cancellation when a provider ID is known. Settled submission_unknown without a provider ID is explicitly stopped locally as abandoned; locallyStoppedJobIds and providerOutcomeUnknown disclose that outcome. An active dispatch lease must settle before local abandonment/deletion. Old cancellation requests are reconciled too.
Use engui_delete_job(jobId, requestKey) to remove a terminal Job, or locally stop/remove a settled uncertain Job. Requires cancel scope. Read jobId from batch variants. Active known-provider jobs must be cancelled first; preservation of successful originals must finish before deletion. Gallery assets, immutable plans, variant tombstones and start receipts remain, so replaying an old start returns its old batch and never generates again. Deleting locally is NOT proof of remote cancellation; do not automatically regenerate uncertain paid work.

## Generation without a primary Character (MCP 2.0)
engui_prepare_generation does NOT accept characterId, characterVersionId or outfitId. Remove these fields from client calls; they are rejected, not ignored. No Character card is required, even in an empty workspace. Do not create a dummy Character or erase a real card to generate plain text.
Plain text without Character tags receives NO implicit identity or outfit. Framing defaults to custom (no prefix); framing, view and Vibe affect the text only when explicitly selected. Stored wildcards and seeded alternatives still expand. Inspect snapshot.variants[].prompt for the exact provider text.
Inline mode (one or more Character tags, including tags from a wildcard or Vibe): descriptions are inserted ONLY at tag locations. Tag every intended person; no primary Character is chosen from the first tag. Tags capture current identities and, with :withOutfit, current default clothing. New plans have snapshot.schemaVersion=2 and characterMode plain or inline.
Concept review is separate: engui_record_concept_review still requires its own characterId to explicitly associate an image with a Character. It never changes generation text. Generated assets retain trusted plan/variant provenance; imported assets still need snapshotPlanId referencing that asset. Review records capture their selected Character for freshness checks.
Historical plans and approved references remain readable and unchanged. Old plans retain their original frozen prompts and original Character freshness checks; newly prepared plans use only tags. Reconnect MCP to reload the changed input schema. This tool prepares ordinary image Jobs, not a saved Prompt/scene entity.

## Character syntax (positive prompt only)
- {character:UUID}: current Character identity, WITHOUT clothing text; this does not mean nude.
- {character:UUID:withOutfit}: current identity plus CURRENT DEFAULT outfit. Missing/unavailable default outfit is an error; select one in Characters/wardrobe or use identity-only.
- Discover UUIDs via engui_list_characters. Multiple characters and repeated tags are supported within the fixed workspace, up to 32 distinct characters. Repeated tags use the same frozen source per preparation.
- Example: {character:PRIMARY_UUID:withOutfit} faces {character:RIVAL_UUID}. A wide shot in a rainy courtyard.
- UUID placeholders in examples must be replaced with real IDs. Unknown, deleted, foreign or malformed Character references fail with INVALID_CHARACTER_REFERENCE; no plan is saved. Negative prompt tags are rejected explicitly.
- Tags use full current identity text, not automatic region-cropped identity classification. Choose framing/action deliberately. Appearance text is literal: its braces and dollar signs are not evaluated recursively.

## Wildcards and seeded alternatives
Call engui_list_wildcards (query/cursor/limit) for active keys and values in this workspace. This read does not create defaults or edit wildcards.
- {key} expands a stored wildcard. {key:variantText} selects a matching value; {key:0,2} selects zero-based alternatives. MCP does not offer a persistent sequential cursor.
- {red|blue} chooses one alternative deterministically per seed. Character tags inside alternatives are protected before selection and inserted afterwards.
- Vibe text and wildcard expansion happen before seeded choices; all referenced Character tags in the expanded template must be valid, including alternative branches.
- Unknown ordinary wildcard keys remain literal text for compatibility: inspect the exact prepared prompts. Do not invent keys.

## Provenance, errors and reuse
The original source is snapshot.draft.prompt. snapshot.stages.expandedPrompt is the expanded TEMPLATE and can still contain tags. Actual provider prompts are snapshot.variants[].prompt.
Character substitutions are recorded separately in snapshot.characterReferences, snapshot.stages.characterReferences and each variant.characterReferences, including token, Character version, optional outfit revision and resolved text. wildcardReplacements is ONLY the ordinary wildcard log; an empty list does not mean Character resolution failed.
Plans are immutable. Edited/deleted referenced characters or changed default outfits invalidate an unstarted plan with PLAN_STALE; prepare again using a NEW requestKey. Historical plans and already-generated images are never rewritten. Legacy unresolved-tag plans must be prepared again. Do not start a plan containing an unintended literal tag.
This syntax works in MCP and Create Image/Create Video. Prompts/Prompt Constructor has no tag expansion; its existing Characters workflow remains separate. MCP currently exposes image generation, not Create Video's full API.
