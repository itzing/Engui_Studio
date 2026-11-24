# ENGUI-604 — Cancel/delete uncertain jobs in UI and MCP

## Status
Done

## Request
Owner14789: explain the two-active-batch limit; repair stuck cancelled Qwen batch82120573/job e986dc8e; allow UI desktop/mobile and agents to cancel/delete such work.

## Scope
Keep configurable MCP active-batch default2 (local concurrency guard, not provider restriction). Explicit terminal abandoned state for local stop with unknown provider outcome; free active slot without claiming remote cancellation. Retain batch/variant/receipt evidence to prevent replay. No automatic regeneration. Shared UI cancel/delete path, MCP cancellation and new delete_job tool. Known remote jobs still require normal cancellation; active dispatch leases cannot be discarded. Test late receipts and worker restart. Deploy, back up and retire/remove the requested stuck Job; preserve gallery and immutable plans.

## Candidate verification
-166 tests across8files passed: MCP/Character regression, SDK/API cancellation/deletion/idempotency/quota, active lease refusal, cross-workspace protection, late receipt under the real prepared-submission boundary with a fake provider, shared Batch Cards path and queue notifications.
- Production-build HTTP SDK8checks passed (cancel-only scope, new delete tool, local outcome, terminal counters, deletion/replay). No provider calls.
- Real desktop list/details and mobile list/details:18checks each in Chromium and WebKit,36total. Actions reached the real isolated Jobs API; no paid generation. First harness pass raced mobile list refresh and omitted an existing synthetic editor-init stub; final clean rerun passed. No application workaround for these harness issues.
- Isolated production build passed;125normalized TypeScript baseline/candidate diagnostics, none added. New Job status union integrated with notification types without changing notification behavior.
- Run artifacts /home/engui/engui-runs/engui-604-20261124; browser evidence workspace runs/engui-job-cancel-20261124. Fixture databases contain synthetic data/settings only, workers disabled.
- Requested Qwen Job/variant/batch/plan backed up privately before promotion. It has no provider ID and no Gallery copies. Existing cancellation intent confirmed; no other job is targeted.

## Deployment and requested Qwen repair
- Feature commit `33092d6` pushed; installed MCP1.4.0 exposes26tools. Build `eMgBxMhown1gD6q4qiOnt`, previous `FAGk9XqoocuEcySVZk0oG` retained with rollback.py. No migration/token change.
- Public Showdown SDK9checks passed. Replayed the existing cancellation intent for batch82120573, then used engui_delete_job for Job e986dc8e; deletion retry returned the same receipt. Job is absent, variant/batch/plan/start tombstones retained as abandoned, provider outcome explicitly unknown. No provider ID exists, so remote cancellation is not claimed.
- UI Jobs API returns404 for the deleted Job. Other Jobs fingerprint unchanged; Showdown active batch count 0. Default configurable cap2 retained, no generation or duplicate submission.
- Service active/running,NRestarts0. Candidate preview stopped. Owner should refresh UI and reconnect MCP to load the new tool/schema.
