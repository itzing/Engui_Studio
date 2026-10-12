# Workspace isolation — implementation and validation

Status: release candidate; production cutover pending.
Date: 2026-10-12
Scope: desktop and mobile, per the approved specification and implementation plan.

## Preservation and backup

- Original protected Default: `214653b8-0416-447a-bdfd-22e00785bedd`; its identity, existing content IDs, relationships, LoRA paths and gallery history are preserved.
- The user explicitly accepted a backup on the same NVMe after the existing read error. This protects against application/migration mistakes, not physical device failure.
- The unreadable PNG and its exact gallery record/derivatives were removed only after a separate explicit user instruction. Metadata and readable previews were retained privately.
- Initial media backup verified 26,061 readable files; the one unreadable original was documented rather than silently substituted.
- A fresh pre-cutover media copy is being retained because production continued to receive new images during implementation.
- The versioned migration compares stable field hashes/counts and pre-existing ownership across all 42 original tables, checks foreign keys, and records a checksum. Repeating it is a verified no-op.
- No existing S3 weights are relocated, rewritten or deleted by deployment. Their bytes are not duplicated into this local backup; existing paths remain the rollback reference.
- Private evidence and rollback artifacts: `/home/engui/backups/workspaces-20261012/`. Do not commit database snapshots, settings, credentials, generated media or browser screenshots.

## Ownership and surface coverage

- `workspace-route-inventory.json` enumerates all 155 API route files, including explicitly global and disabled legacy routes.
- `src/lib/workspaces/ownership.json` classifies original content roots, inherited children and global/operational models. WorkspaceActivity is an additional operational writer fence.
- Direct-ID queries, mixed bulk writes, inherited parents, JSON content/media references, browser draft/media ownership and delayed requests are checked.
- Keys, application settings, helper/provider connections and account-wide operational telemetry remain global.
- Browser selection is persisted per tab; a new tab may use the browser's last explicit choice. Creating a workspace, reloading, reconnecting and another tab's selection do not silently move the current tab.
- Missing/deleting selection displays a picker with management/retry access instead of falling back to Default.
- Desktop includes workspace management; mobile exposes it in Advanced Settings.
- Public media URLs remain the existing static delivery mechanism, not a new authentication/privacy boundary.

## LoRA and S3 decisions confirmed against RunPod

- Default's existing root `loras/` and existing paths remain unchanged.
- Other workspace prefixes are `loras/workspaces/<workspace-id>/`.
- Only Default-owned LoRAs may be shared. Consumers cannot edit the source; WAN pairs are shared coherently.
- Shared-source deletion is fenced against submissions that have not yet persisted their job, then waits for accepted jobs.
- Real RunPod testing showed the SDK's trailing slash on bucket listing paths causes HTTP 400. Only bucket-level listing paths are normalized, before signing; object paths are untouched.
- RunPod drops custom multipart metadata and ignores conditional completion collision protection. Consequently **new uploads receive a server-generated UUID in the physical object key**, while preserving the original display filename. Existing object keys are not renamed.
- Expected multipart ETag and size are durably recorded before completion. Recovery and cleanup require matching proof, not just a matching name or size.
- Pending uploads can be finished or discarded through the library on either surface. Changed storage targets fail closed.
- Sync requires complete, well-formed pagination and independent HEAD absence before pruning. Access errors, partial/malformed listing, changed targets, pending uploads and expired coordination suppress deletion.
- Endpoint source fixtures executed the actual Z-Image path/cache functions and WAN workflow assignment code without loading GPU models: nested paths and same-basename cache separation passed.

## Durable deletion

- Default is guarded at the API and SQLite levels; its protection/identity cannot be reassigned.
- Other workspaces first become unavailable for new writes. A persistent operation journal drains writers and provider jobs, aborts uploads, captures owned resources and retries cleanup.
- A provider cancel acknowledgement is not treated as terminal confirmation.
- Cleanup unlinks exact owned public, historical generations and temporary paths; it never recursively removes a content tree. Symlink/out-of-root paths fail closed.
- Resources referenced by other valid owners are retained. Shared Default sources and global settings are preserved.
- Failed cleanup remains visible/retryable; no transfer/unassign fallback exists.
- SQLite WAL and serialized primary-client transactions avoid lock escalation between request writers and independent ownership readers.

## Completed checks

- Schema validation/client generation and repeated migration rehearsal on a consistent copy.
- API/database integration: A/B reads, foreign direct-ID mutation, mixed bulk, inherited parent ownership, immutable Default, shared-source permissions, scope mismatch, writer drain, confirmed provider cancellation, exact public/legacy/temp cleanup, repeat deletion, Default gallery preservation.
- 24 focused workspace tests: browser/IndexedDB isolation, legacy draft preservation, delayed callbacks, all-drafts GC, safe S3 pruning, expired leases, multipart recovery proof, WAN path/pair separation.
- 32 existing business regressions: LoRA filtering/weights, video presets, reuse and persisted reuse drafts.
- Real Chromium desktop and mobile: management/create without auto-switch, reload persistence, independent tabs, new empty gallery, foreign-ID rejection and no API 5xx on the corrected WAL candidate.
- Real S3 read-only listing and HEAD verification passed through the corrected SDK client.
- Tiny unique temporary S3 fixtures verified multipart behavior. The complete new upload service was exercised on an isolated database: part upload, checksum-verified completion, idempotent retry, original display filename, unique physical key, exact object deletion and whole fixture-workspace cleanup. Fixture objects were deleted and absence confirmed.
- Isolated production builds passed; a final production-path build is required at cutover.
- Existing repository-wide TypeScript diagnostics were compared separately against unchanged production. This release does not claim the entire pre-existing type-check/test suite is clean; new workspace-specific diagnostics are addressed.
- No paid RunPod/Studio generation jobs were launched. Actual generated-image quality remains the user's validation.

## Cutover and rollback

1. Wait for existing submissions to finish. Stop only Engui Studio, not helper/OpenClaw services.
2. Refresh the same-disk media backup and take a consistent SQLite snapshot, old schema/client/build and code revision. Verify the snapshot and exact excluded asset.
3. Apply the checked migration with that snapshot as the required backup. Preservation failure aborts the release.
4. Generate Prisma, build production under the isolated-validation flag so build workers cannot run, then restart Engui explicitly with sudo.
5. Check service, protected Default identity/counts, settings connectivity, representative owned endpoints and unchanged LoRA metadata.
6. Before reopening a failed release, rollback code/schema/client/build and the quiesced database snapshot. After users resume writing, capture/reconcile the new data first; do not blindly restore an older snapshot.

No schema push/reset, destructive legacy migration endpoint, automatic S3 sync or data transfer is part of deployment.
