# ENGUI-605 — Remove primary Character selection from MCP generation

## Status
In Progress

## Request and scope
Owner14805: remove characterId completely from engui_prepare_generation. MCP-only; no UI changes and no RunPod Qwen continuation. New preparation accepts plain prompts or inline Character tags; no implicit identity/outfit. Remove associated characterVersionId/outfitId selectors rather than accept ignored fields. Default framing custom (no implicit full-body prefix), explicit framing/view/Vibe/wildcards retained. Plain plans must work in workspaces with zero characters. New schema rejects removed fields. Preserve immutable historical plans, start receipts and legacy validation. Explicit concept review retains its own Character selection, with trusted asset association and independent reference freshness.

## Validation and delivery
Isolated SDK integration tests for discovery, plain/tagged/multi-person plans, source freshness, encrypted submission, Gallery and review, legacy plans and cancellation regressions. No paid provider jobs. Production build, source/type baseline comparison, HTTP SDK candidate and live proof. Commit/push/deploy with previous build retained. No DB migration expected.

## Candidate verification
-173 tests across8files passed: removed-field discovery/rejection, empty-workspace plain text and exact encrypted submission, no unrelated Character dependency, multi-character tags and workspace isolation, separate explicit reference selection, legacy plan/reference freshness, cancellation and shared UI tag regressions.
- Production build passed;125baseline/candidate TypeScript diagnostics, none added. Source hashes match the candidate. No schema migration and no UI changes.
- Official SDK against isolated production HTTP server:14checks passed using empty and two-Character workspaces, synthetic provider settings only; no start/generation requests. Initial test adjustments fixed a legacy wording expectation and bounded end-to-end test timeout; final run clean.
- MCP protocol server version2.0.0; envelope schemaVersion1 unchanged, new plan snapshot schemaVersion2. Default framing custom, only explicit framing/view/Vibe alter plain input besides supported tag/wildcard syntax.
- Existing production Jobs15completed, no active MCP variants/uploads/activities before promotion. Historical Showdown plan snapshot/digest and Jobs fingerprint saved privately for live verification.
- Evidence /home/engui/engui-runs/engui-605-20261124. Old production build retained during promotion for rollback.
