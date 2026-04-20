---
id: engui-153
title: Implement transactional model switching and draft normalization
status: done
priority: high
labels: [mobile, create, frontend, shared-logic]
created_at: 2026-04-20
updated_at: 2026-04-20
completed_at: 2026-04-20
assignee: openclaw
---

## Summary
Replace ad-hoc model synchronization with a transactional workflow/model switch operation that saves the previous draft, restores the target draft, and normalizes incompatible parameters and inputs in one state transition.

## Desired outcome
Switching between models such as `flux-krea`, `z-image`, and `qwen-image-edit` always restores the correct draft for that model, without stale state or temporary repair hacks.

## Dependencies
- ENGUI-151
- ENGUI-152
- `backlog/specs/unified-create-state-implementation.md`

## Scope
- Add centralized draft normalization helpers per workflow and model.
- Implement atomic `switchWorkflowModel` behavior.
- Preserve compatible prompt and parameter values.
- Drop incompatible parameters and media refs during model transitions.
- Remove temporary model-sync hacks introduced for cached mobile navigation.

## Acceptance criteria
- [x] Switching from one image model to another saves the current model draft before leaving it
- [x] Switching back restores the exact previous draft for the original model
- [x] Incompatible parameters are removed or re-defaulted centrally
- [x] Model-specific inputs such as ControlNet image refs are kept only when valid for the target model
- [x] Mobile model switching no longer depends on `pending-image-model`, custom selection events, or page focus repair listeners

## Completion notes

Implemented transactional mobile image-model switching in `useImageCreateDraftPersistence` and centralized target-model normalization in `src/lib/create/imageDraft.ts` via `normalizeImageDraftForModel()`.

Behavior now:
- current image draft is normalized and saved before leaving the current model
- target model becomes active in storage before hydration
- target draft is restored if it exists, otherwise target defaults are used
- incompatible parameters are filtered out centrally
- image refs are preserved only when the target model still exposes the relevant inputs

Mobile-specific cleanup in this phase:
- removed `engui.mobile.pending-image-model` usage from `MobileModelScreen`
- removed `pageshow`, `focus`, and `visibilitychange` model repair sync from `useImageCreateState`
- retained a no-op `skipNextModelHydration` compatibility export only to avoid breaking remaining desktop callers during the phased rollout

Validation:
- `npx vitest --run tests/lib/image-draft-normalization.test.ts` ✅
- `npm run build` ✅
