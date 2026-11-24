# ENGUI-604 — Cancel/delete uncertain jobs in UI and MCP

## Status
In Progress

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
