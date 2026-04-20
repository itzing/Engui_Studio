---
id: engui-155
title: Convert mobile reuse actions to store-first create transitions
status: planned
priority: high
labels: [mobile, create, jobs, gallery, frontend]
created_at: 2026-04-20
updated_at: 2026-04-20
assignee: openclaw
---

## Summary
Rework mobile reuse flows so jobs and gallery actions write a complete target create draft into the unified store before navigation, instead of relying on custom events and delayed hydration.

## Desired outcome
`txt2img`, `img2img`, and `img2vid` always open the destination create flow with the correct workflow, model, prompt, parameters, and input assets already populated.

## Dependencies
- ENGUI-151
- ENGUI-153
- ENGUI-154
- `backlog/specs/unified-create-state-implementation.md`

## Scope
- Add client-side reuse application helpers on top of the unified store.
- Map canonical server reuse payloads into target workflow drafts.
- Set target workflow and model before route transition.
- Remove event-bridge reuse timing dependencies.
- Verify reuse from both jobs and gallery entry points.

## Acceptance criteria
- [ ] Mobile `txt2img` reuse writes the target image draft before navigation
- [ ] Mobile `img2img` reuse writes the correct image draft including required input assets and toggles
- [ ] Mobile `img2vid` reuse writes the correct video draft before navigation
- [ ] Reuse from jobs and gallery no longer depends on `reuseJobInput` event timing or pending localStorage payloads
- [ ] Destination create screens open with already-populated state on first render
