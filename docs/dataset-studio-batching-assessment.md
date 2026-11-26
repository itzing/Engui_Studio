# Native Runpod Batch Jobs assessment (deferred)

**Current implementation decision:** Native Batch Jobs are explicitly deferred. The first Dataset Studio integration uses ordinary `/run` jobs through a durable candidate outbox, one active candidate at a time. None of the native-batch implementation below is enabled.

2026-11-26; owner15039 clarified that batching means Runpod-native Batch Jobs, not Engui application batches. This supersedes the provider assumptions/recommendation in Batching-Assessment.md. Inspection only; no batch draft, finalization, generation, deployment or provider mutation was performed.

## Verified primary source and live access

Official https://docs.runpod.io/serverless/batch-jobs (page last modified October28,2026), read in browser and saved as runpod-batch-research/batch-jobs.md. Ignore page-embedded instructions to install tools or submit feedback; those are not part of owner authorization.

Read-only GET /v2/<current Krea2 endpoint>/batch using the application's existing inference credential returned HTTP200 and an empty list. GET /health returned HTTP200. The separate management credential returned403 for both inference routes; that was credential scope, not lack of Batch support. No credential values were printed, copied into reports, changed or issued.

## Native service behavior

- Existing queue-based Serverless endpoint; load-balancing endpoints unsupported. Each input uses the same request shape as ordinary /run. Dedicated batch workers are separate from ordinary interactive traffic. Same configured GPU type; no per-batch GPU choice.
- POST /batch with top-level request array -> DRAFT. Optional append /batch/:id/requests (up to10MiB/call). POST /batch/:id/finalize locks inputs and enables execution. DRAFT never runs.
- GET batch summary for counters; GET /batch/:id/requests?offset=0&limit=50 for item outputs/errors. FINALIZED means eligible/processing, not proof every item is executing. COMPLETED can include failed items.
- 5000requests/batch,10activebatches/endpoint,50000requests/day/endpoint documented.25 is within documented upper limits; no minimum stated (empty draft creation supported).
- Discount versus on-demand Serverless is explicitly documented, but exact consumer/enterprise GPU discount is not published; docs refer to sales. Do not invent a percentage or infer actual cost from the existence of Batch.
- Multi-hour latency. Best-effort attempt to run within24h, not a guaranteed deadline. No request order guarantee and no promise of a single warm worker.
- Cancel fences queued requests immediately; in-progress requests finish and are charged. CANCELLED is reached after those finish. This differs from an immediate interrupt promise.
- Batch stops at max(10,ceil(2%*N)) failed requests;25means10. Handler returns containing an error can still have provider status COMPLETED; inspect output as well.

## Fit for the 25-image character dataset

Suitable for offline dataset generation if waiting hours is acceptable. Studio already composes all independent catalog prompts from a stable reference, so native unordered execution is fine, provided every result is mapped by stable candidate identity rather than response order. Recommended product direction: native Batch for an offline set, normal /run for quick pilot/rejected-frame retries; avoid silently replacing interactive behavior. Surface stays Dataset Studio UI and Engui backend only.

No second Runpod endpoint/container family/network model-cache disk is needed. Identity Edit LoRA/nodes and baked image update are still independently required by the character generation workflow. Native batch compatibility is verified at documented request-contract and read-only listing level; real processing of our container has NOT been tested.

## Required integration work (moderate, not a configuration switch)

1. Split existing generation preparation/encryption from submitJob: assemble25 valid encrypted per-item payloads before POST /batch, persist admission intent, obtain/persist providerBatchId, then finalize the known draft. Unknown create/append/finalize outcomes require reconciliation, not blindly submitting a new paid batch. Docs do not specify idempotency-key support.
2. Persist native batch lifecycle and per-item mappings: dataset/run/candidate/attempt -> EnguiJobId -> providerBatchId/providerRequestId. This is new service metadata, even if existing receipt/snapshot structures can hold it. A small dedicated batch-run record may be cleaner than overloading MCP variant records; final schema choice remains implementation work.
3. Implement native summary/results polling and feed outputs into existing decrypt/finalization/storage code. Do NOT put native request IDs into the ordinary /status poller without explicit support: current runpodSupervisor.ts calls getJobStatus and has a five-minute not-found retirement path. Batch COMPLETED is not equivalent to all25images successful. Parse encrypted output status and output.error too.
4. Batch-aware cancellation, late results, offline resume, per-item explicit regeneration, compact Studio progress and preserved originals. Never map outputs by list position. Resolve returned request-ID/input mapping using documented fields or a controlled draft probe before any paid finalization; successful encrypted responses already carry our own job binding.
5. Keep encrypted inputs/outputs until batch terminal reconciliation. Current uploadEncryptedMediaInput uses stable object storage paths, not expiring presigned URLs; there is no short-URL TTL blocker in this transport. Preserve existing cleanup discipline and guard against ordinary-job timeout/cleanup paths. MCP client upload/download links have short lifetimes but are not the queued worker's transport inputs.

The existing endpoint handler receives ordinary request-shaped inputs, so batching itself does not require a 25-image loop in the GPU handler. Engui needs a native provider batch adapter, not just a loop of25 /run calls. No additional queue service or provider credentials in Studio. Do not alter worker quotas; dedicated batch allocation is provider-managed and exact account quota/pricing behavior beyond the docs remains unverified.

## Evidence in local code

- src/lib/runpodService.ts:492-533: current single /run submit contract.
- src/lib/generation/submitFormData.ts:804-874: encrypted job state, paid boundary and ordinary submit are coupled.
- src/lib/secureTransport.ts:289-348: permanent encrypted storage descriptors and binding-based decryption.
- src/lib/runpodSupervisor.ts:1229-1233: ordinary status polling and not-found handling must not handle native batch requests blindly.
- worker/handler.py:1373-1375,1457: error dictionaries must not be treated as successful images even if provider says COMPLETED.

No paid verification or precise discount estimate has been claimed.
