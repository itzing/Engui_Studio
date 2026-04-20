---
id: engui-159
title: Remove desktop create event bus and converge reuse onto store-first drafts
status: planned
priority: medium
labels: [desktop, create, frontend, cleanup]
created_at: 2026-04-20
updated_at: 2026-04-20
assignee: openclaw
---

## Summary
Clean up remaining desktop create-state synchronization hacks that still depend on `reuseJobInput`, cross-panel event dispatch, and shared `StudioContext.selectedModel` behavior.

## Desired outcome
Desktop create flows use the same store-first draft transition model as mobile, with predictable workflow-scoped state and no timing-sensitive event rebroadcast between panels.

## Scope
- Replace desktop reuse event dispatch with explicit draft persistence helpers.
- Remove `reuseJobInput` rebroadcast logic from `LeftPanel`, `CenterPanel`, and `StudioContext` where no longer needed.
- Converge desktop image/video model switching onto workflow-local state contracts.
- Keep existing desktop UX intact while simplifying internal data flow.

## Acceptance criteria
- [ ] Desktop reuse no longer depends on `reuseJobInput` timing
- [ ] Desktop create forms restore from workflow-scoped drafts directly
- [ ] Shared global model state is no longer the source of truth for cross-workflow desktop create behavior
- [ ] Legacy desktop event rebroadcast paths are removed or reduced to compatibility shims only
