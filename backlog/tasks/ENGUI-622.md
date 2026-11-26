---
id: ENGUI-622
title: Keep Dataset Studio transport references out of Gallery and Drafts
status: Done
assignee: [OpenClaw]
created_date: '2026-11-26 21:08'
labels: [datasets, integration, bug, reference]
---

## Evidence
Three candidates completed; the shared reference Draft was then trashed. All seventeen later candidates failed during create_upload before any remote job submission. The Studio-pinned reference remains intact.

## Scope
Owner follow-up: Dataset Studio must never create Gallery/Draft records. Add a separate internal Dataset upload lane backed by registered workspace files and upload receipts; retain public MCP uploads unchanged. Studio stores generated originals itself. Missing private transport copies may be replaced from pinned Studio bytes before submission. Never restore a trashed Gallery asset, rotate on transient/auth errors, mutate a submitted attempt or automatically restart failed paid jobs. Preserve the existing public MCP contract and operator model policy.

## Validation
Cover missing/retired uploads, shared replacement reuse, interrupted upload response/restart, unrelated errors and uncertain-submit replay. Live upload-only check, original hashes and job counts unchanged. No paid generation.

## Rollback
Restore the backed-up installed bridge module and restart dataset-studio.service. Keep original dataset files, historical job payloads and Gallery Trash unchanged.

## Delivered
Engui `b121e20` and Studio `1470376` deployed. Dataset uploads now use internal files/receipts without Gallery assets, while ordinary MCP imports are unchanged. Existing historical Gallery-backed plans are retained. Scoped upload-only live proof reused the current reference and verified exact bytes, unchanged Gallery and Job IDs, and all three current Studio originals plus seventeen failed cards unchanged. No paid inference or automatic retry.

79 Engui integration checks passed (private bridge/end-to-end original download, MCP uploads, artifacts and Gallery). 80 Studio queue/engine checks passed. Targeted lint and production build passed; no new TypeScript diagnostics compared with baseline. Both services are active. Three concurrent unrelated provider-job handles were preserved across deployment. Prior build and Studio module are retained for rollback.
