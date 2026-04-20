---
id: engui-142
title: Build mobile preview, jobs, and gallery screens
status: done
priority: high
labels: [mobile, preview, jobs, gallery]
created_at: 2026-04-20
updated_at: 2026-04-20
completed_at: 2026-04-20
assignee: openclaw
---

## Summary

Build route-based mobile screens for Preview, Jobs, and Gallery so the phone experience no longer depends on the current mobile tab wrapper around desktop-oriented panels.

## Desired outcome

Phone users can navigate between read-focused screens using dedicated routes and mobile-first layouts.

## Acceptance criteria

- [x] `/m/preview` exists as a standalone mobile screen
- [x] `/m/jobs` exists as a standalone mobile screen
- [x] `/m/gallery` exists as a standalone mobile screen
- [x] Navigation between these screens is route-based
- [x] Desktop read flows remain unchanged

## Completion notes

Completed by replacing the temporary route wrappers with dedicated mobile-first screens for Preview, Jobs, and Gallery. Added standalone mobile data/state layers for job lists, gallery lists, and shared preview selection under `src/hooks/jobs/*`, `src/hooks/gallery/*`, `src/hooks/mobile/*`, and `src/lib/mobile/*`. Jobs and Gallery now open items into the standalone `/m/preview` route, while desktop read flows remain unchanged. Dedicated item detail routes are intentionally deferred to `engui-143`.
