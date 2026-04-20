---
id: engui-157
title: Run unified create state regression and cleanup legacy sync hacks
status: planned
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
- [ ] Automated coverage exists for migration, model switching, reuse mapping, and media ref persistence
- [ ] Manual QA covers Safari browser mode and iPhone PWA standalone mode
- [ ] Legacy sync hacks are removed once the new architecture is proven
- [ ] Mobile create no longer relies on pending localStorage keys or focus/page visibility repair listeners for correctness
- [ ] Desktop create behavior is regression-checked and any remaining gaps are documented
