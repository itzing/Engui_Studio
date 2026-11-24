# ENGUI-603 — Accurate MCP batch execution status

## Status
Done

## Request
Owner14786: MCP reports running while the Job is still queued, confusing the connected agent.

## Scope and approach
MCP reporting only. Derive public execution state from workspace-scoped Jobs, retaining durable worker lifecycle internally. No scheduler, provider submission, UI, database migration or historical plan changes. Separate local queue, submission, provider queue, confirmed execution, finalization and unknown status. Report per-variant phase, raw lifecycle/job status, cancellation, blocked work, terminal flag, summary and mutually exclusive counts. Document semantics in discovery and guide. Do not fabricate queue positions, ETA or inference percentages.

## Acceptance
- Queued accepted jobs are never reported running. Mixed completed/queued batches remain queued, not running.
- Confirmed execution/finalization, missing/unknown Job, cancellation and ambiguous submission are distinct. Unknown acceptance blocks remaining work; reads do not submit or mutate.
- SDK discovered output schema retains all added fields, workspace isolation and worker recovery still hold.
- Isolated tests and production build, commit/push/deploy, read-only live verification. No paid generation.

## Rollback
Preserve prior .next under /home/engui/engui-runs/engui-603-20261124; restore and restart engui-studio.service.

## Candidate verification
- 128 tests across six files passed, including 32 status cases, four discovered-SDK scenarios, worker recovery and Character-tag regression coverage.
- Production-build HTTP SDK: 11 checks passed over seven synthetic batch scenarios. Read-only fixture credential; workers disabled; no provider calls.
- Production build passed. TypeScript diagnostics unchanged: 125 baseline/candidate, no added normalized diagnostics.
- No production fixtures, generation, token changes or schema migrations. Existing unknown-submission job remains untouched.
- Evidence: /home/engui/engui-runs/engui-603-20261124. First test run rejected the fixture filename in an existing guard; reran all tests on a fresh schema-only database with the expected guarded name.

## Deployment
- Feature commit `f1947c6` pushed to origin/main; MCP 1.3.0 installed.
- Live build `FAGk9XqoocuEcySVZk0oG`; previous `zKBv1x5mqrCq4a_IsY0EL` retained under the run directory with rollback.py.
- Public Showdown SDK: 10 checks passed on four existing batches, including discoverable schema/guide and accurate terminal/uncertain states. No production plans, batches or paid inference created.
- Service active/running, NRestarts=0. Existing submission_unknown Job fingerprint unchanged. Isolated preview stopped.
- Reconnect MCP to refresh cached tool descriptions. Existing batch IDs immediately use the new reporting; no new plan, token or generation required.
