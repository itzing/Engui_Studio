---
id: engui-153
title: Implement transactional model switching and draft normalization
status: planned
priority: high
labels: [mobile, create, frontend, shared-logic]
created_at: 2026-04-20
updated_at: 2026-04-20
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
- [ ] Switching from one image model to another saves the current model draft before leaving it
- [ ] Switching back restores the exact previous draft for the original model
- [ ] Incompatible parameters are removed or re-defaulted centrally
- [ ] Model-specific inputs such as ControlNet image refs are kept only when valid for the target model
- [ ] Mobile model switching no longer depends on `pending-image-model`, custom selection events, or page focus repair listeners
