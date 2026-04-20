---
id: engui-159
title: Remove desktop create event bus and converge reuse onto store-first drafts
status: done
priority: medium
labels: [desktop, create, frontend, cleanup]
created_at: 2026-04-20
updated_at: 2026-04-20
completed_at: 2026-04-20
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
- [x] Desktop reuse no longer depends on `reuseJobInput` timing
- [x] Desktop create forms restore from workflow-scoped drafts directly
- [x] Shared global model state is no longer the source of truth for cross-workflow desktop create behavior
- [x] Legacy desktop event rebroadcast paths are removed or reduced to compatibility shims only

## Completion notes

Removed the remaining create-form `reuseJobInput` event listeners and compatibility no-ops now that desktop and mobile reuse both restore from workflow-scoped persisted drafts.

Changes:
- removed dead `reuseJobInput` listeners from `ImageGenerationForm`, `VideoGenerationForm`, `AudioGenerationForm`, and `MusicGenerationForm`
- removed obsolete `reuseJobInput` tab-opening hook from `MobileStudioLayout`; create navigation now relies on explicit mobile open events only
- removed the legacy `skipNextModelHydration` compatibility export from `useImageCreateDraftPersistence`
- verified there are no remaining `reuseJobInput` window event listeners/dispatchers in `src/`

Validation:
- `grep -R "window.addEventListener('reuseJobInput'\|window.dispatchEvent(new CustomEvent('reuseJobInput'\|skipNextModelHydration" -n src` returns no matches ✅
- `npx vitest --run tests/lib/create-drafts-v2.test.ts tests/lib/persist-create-reuse-draft.test.ts tests/lib/image-draft-normalization.test.ts tests/lib/create-media-store.test.ts` ✅
- `npm run build` ✅
