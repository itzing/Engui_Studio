# ENGUI-609 — Discover external Jobs in live main-screen navigation

## Status
Validated locally; browser verification and deployment pending.

## Authorization and scope
Owner14860 reports main-screen left/right navigation missing Jobs created on another device or MCP until reload. Fix shared browser Job synchronization used by desktop/tablet/mobile previews, not an MCP API or endpoint feature. No generation or UI redesign.

## Cause and plan
RightPanel independently refreshes /api/jobs(all=true), while StudioContext loads only50 Jobs once and subsequently polls only already-known active IDs. CenterPanel navigates the stale context. Replace known-ID polling with workspace-scoped full-list synchronization every5s, even when idle, plus visibility/focus/online refresh. Keep selected IDs; fence stale/overlapping responses and optimistic writes, keep last good list on failure, discover completion/deletion too. Preserve jobsLoaded/jobsSyncVersion semantics for mobile notifications.

## Validation/rollback
Focused hooks and actual-browser main-screen arrow navigation, external completion/deletion, selected item continuity, >50Jobs and workspace races. Relevant mobile notification regressions. Isolated production build; save prior build, commit/push/deploy when no active work, no paid jobs. MCP2.2 original-artifact download remains intact.

## Verification so far
57 focused hook/mobile tests passed (13 new synchronization scenarios). Production build7xz-oF-napPc_mnj6XQPe passed. Existing repository TypeScript diagnostics unchanged; no new errors. Browser fixture tests prohibit writes; Chromium desktop/tablet/phone navigation has passed. Full Chromium/WebKit result will be recorded after rollout.

Evidence: /home/engui/engui-runs/engui-609-20261124 and workspace runs/engui-609-20261124.
