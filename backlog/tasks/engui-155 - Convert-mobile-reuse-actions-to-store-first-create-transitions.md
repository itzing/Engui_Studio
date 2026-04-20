---
id: engui-155
title: Convert mobile reuse actions to store-first create transitions
status: done
priority: high
labels: [mobile, create, jobs, gallery, frontend]
created_at: 2026-04-20
updated_at: 2026-04-20
completed_at: 2026-04-20
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
- [x] Mobile `txt2img` reuse writes the target image draft before navigation
- [x] Mobile `img2img` reuse writes the correct image draft including required input assets and toggles
- [x] Mobile `img2vid` reuse writes the correct video draft before navigation
- [x] Reuse from jobs and gallery no longer depends on `reuseJobInput` event timing or pending localStorage payloads
- [x] Destination create screens open with already-populated state on first render

## Completion notes

Converted mobile reuse flows to store-first draft transitions.

Changes:
- added `src/lib/create/persistCreateReuseDraft.ts` to map canonical reuse payloads into image or video workflow drafts before navigation
- updated mobile job details, gallery details, and preview screens to persist the target draft first and then route to `/m/create`
- added explicit mobile actions for `txt2img`, `img2img`, and `img2vid`
- removed mobile dependence on `reuseJobInput` dispatch timing and pending localStorage replay
- updated video draft hydration so remote image/video preview URLs restore into usable submit state on first render

Validation:
- `npx vitest --run tests/lib/persist-create-reuse-draft.test.ts tests/lib/image-draft-normalization.test.ts tests/lib/create-media-store.test.ts` ✅
- `npm run build` ✅
