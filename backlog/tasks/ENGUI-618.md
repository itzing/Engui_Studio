---
id: ENGUI-618
title: MCP bulk deletion for Jobs and Gallery assets
status: Done
assignee: [OpenClaw]
created_date: '2026-11-26 16:16'
labels: [mcp, gallery, jobs]
---

## Request
Owner14991: agents need to delete many Jobs and Gallery items without one tool call per item. MCP only; existing UI/provider behavior stays unchanged.

## Acceptance criteria
- Discoverable typed engui_delete_jobs and engui_delete_gallery_assets, each accepting 1–100 unique items and one UUID requestKey.
- Same cancel/curate scopes and workspace boundaries as individual tools; Gallery remains reversible Trash with expectedRevision from search/detail. No automatic cancellation of known-provider active Jobs.
- Per-item success/error and aggregate counts, partial success preserved. Reserve batch input before side effects; same-key resume/replay never reapplies successful items. Changed payload is rejected before further side effects. A fresh key is needed to retry reported item failures.
- Search results already provide revisions; agents do not need per-image reads before bulk deletion. Existing single-item tools remain compatible.
- Isolated integration/HTTP tests cover mixed outcomes, replay/resume/concurrency, invalid arguments, scopes, workspace isolation, preserved originals and no provider requests. Production discovery verified read-only.
- Build/commit/push/deploy with previous build retained. No user data cleanup or paid inference as validation.

## Rollback
Restore retained previous .next and restart only if deployment had requested a restart. No schema migration.

## Verified implementation
- Two additive typed MCP tools; MCP2.8.0. Existing individual tools and permissions unchanged. Max100 unique selected items per call, Gallery revisions reusable from search.
- Durable payload reservation before side effects and per-item checkpoints. Expected item failures are reported/frozen; infrastructure failures can be resumed with the same payload/key. No automatic active-Job cancellation or permanent Gallery deletion.
- All252 isolated MCP/image-Vibe regression tests passed; the14 bulk tests also passed on the final source-locked candidate. Cross-workspace, scopes, partial outcomes, replay after restore, retry after busy Job, input validation and simulated interruption covered.
- Production build ZOETafub-1IukNQ4kTune passed; no new TypeScript diagnostics relative to baseline.
- Candidate/live HTTP proof and deployment recorded below when complete. Evidence /home/engui/engui-runs/engui-618-20261126.

## Delivered
- Implementation dcf68c3 pushed to main; MCP2.8.0 installed build ZOETafub-1IukNQ4kTune. Previous build G15gV2nU2co2JKQ-0TE_H retained under the run directory.
- Candidate SDK/HTTP proof passed31 checks, including a real100-image batch in8024ms using revisions from two search pages. Replaying after restoring one image leaves it active; mixed busy/completed Jobs report partial results and do not cancel provider work.
- Public Showdown connector passed17 read-only checks: new tools, input/output schemas, scopes/annotations, advertised bounds and guide. Model policy remains Krea2 Turbo/Z-Image. No user content was deleted or generated in validation.
- All252 regression tests passed; final source-locked14 bulk tests also passed. Production build and TypeScript-delta validation passed. Initial HTTP harness assumed every SDK validation error was JSON; adjusted the harness for standard MCP input-validation text, without application changes.
- Two pre-restart guards correctly blocked new dispatches before touching the service/build. The final guard permits only running MCP variants with matching durable provider receipts and queued/processing Jobs; submitting/unknown/finalizing work, uploads and active workspace operations still block. claim() only submits queued variants; already accepted work resumes polling.
- Eight active provider IDs (2 MCP +6 UI) verified unchanged across successful restart; no cancellation or resubmission. Rollback was not needed.
- Only pre-existing untracked public/uploads and tmp remain in the worktree. No UI, endpoint, schema or model-availability changes.
