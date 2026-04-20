---
id: engui-157
title: Run unified create state regression and cleanup legacy sync hacks
status: blocked
priority: high
labels: [mobile, pwa, qa, desktop]
created_at: 2026-04-20
updated_at: 2026-04-20
assignee: openclaw
---

## Summary
Run a focused regression pass for the unified create-state rollout, verify Safari and iPhone PWA behavior, and remove obsolete synchronization hacks that are no longer needed after the provider/store migration.

## Desired outcome
The new architecture is validated under real mobile navigation conditions, legacy repair logic is removed, and desktop behavior remains intentionally stable.

## Dependencies
- ENGUI-152
- ENGUI-153
- ENGUI-154
- ENGUI-155
- ENGUI-156
- `backlog/specs/unified-create-state-implementation.md`

## Scope
- Run automated tests for migration, switching, reuse, and media persistence.
- Run manual QA in Safari and PWA standalone mode.
- Remove obsolete event-driven and focus-driven repair logic.
- Confirm no intended desktop UX regressions.
- Capture any remaining follow-up issues as separate tickets.

## Acceptance criteria
- [x] Automated coverage exists for migration, model switching, reuse mapping, and media ref persistence
- [ ] Manual QA covers Safari browser mode and iPhone PWA standalone mode
- [x] Legacy sync hacks are removed once the new architecture is proven
- [x] Mobile create no longer relies on pending localStorage keys or focus/page visibility repair listeners for correctness
- [x] Desktop create behavior is regression-checked and any remaining gaps are documented

## Completion notes

Completed the automated regression pass for the unified create-state rollout and documented the remaining manual-device QA gap.

Automated validation completed:
- `npx vitest --run tests/lib/create-drafts-v2.test.ts tests/lib/image-draft-normalization.test.ts tests/lib/create-media-store.test.ts tests/lib/persist-create-reuse-draft.test.ts` ✅
- `npm run build` ✅

Validated areas:
- unified draft-store migration and per-workflow active-model persistence
- image-model normalization and transactional switching behavior
- IndexedDB media-ref persistence and restoration
- store-first reuse mapping into image and video drafts

Cleanup/result summary:
- mobile create no longer depends on `pending-image-model`, pending reuse localStorage payload replay, or focus/page visibility repair listeners for correctness
- mobile route reuse bridge remains only for route-tab navigation, not state repair
- remaining legacy event-bus behavior is now desktop-scoped and documented separately in `ENGUI-159`

Blocked item:
- Safari browser mode and iPhone PWA standalone QA require a real device/runtime not available in this environment, so manual acceptance remains open
