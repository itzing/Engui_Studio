---
id: ENGUI-570
title: Clear an offscreen gallery return point with a long press
status: Done
assignee: []
created_date: '2026-10-30 11:25'
labels: [mobile, frontend]
dependencies: []
---

## Description

Extend the existing single mobile gallery Save/Clear/Return icon. When a saved item is offscreen, a short tap returns and a long tap clears the saved position without moving the gallery. No extra control.

## Acceptance Criteria

- [x] Holding Return for 600ms clears the saved point without restoring it; release does not save a new point.
- [x] Short tap still returns; normal Save/Clear and keyboard activation remain.
- [x] Movement, cancellation, leaving the control, state/workspace changes and unmount cancel a pending hold.
- [x] Clearing is visibility-checked at action time and persists across reload.
- [x] One existing control, no global touch/viewport changes, no generation jobs.
- [x] Tests, isolated build, browser checks, owner commit/push and deploy complete.

## Plan

See docs/mobile-gallery-position-long-press.md.

## Completion

58 targeted tests and isolated production build pass. WebKit/Chromium preview and deployed HTTPS each pass 27 scenarios per engine, with zero page errors, unexpected API paths or production API writes. Chromium hold uses native touch events; WebKit uses native mouse/pointer input. Physical iPhone hold remains owner-side verification, not a claimed automated test. No generation jobs started. Service restarted 2026-10-30 11:29:44 UTC, prior build retained for rollback. Existing Paste and iPhone viewport fixes preserved.
