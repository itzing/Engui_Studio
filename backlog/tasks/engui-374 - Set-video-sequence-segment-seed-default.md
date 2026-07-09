---
id: engui-374
title: Set video sequence segment seed default
status: Done
created: 2026-07-09
updated: 2026-07-09
---

## Goal

Make new Video Sequence Builder segments deterministic by default.

## Acceptance Criteria

- [x] Newly created video sequence segments default to `seed = 40`.
- [x] Newly created video sequence segments default to `randomizeSeed = false`.
- [x] Inserted template segments inherit the deterministic segment defaults unless an explicit value is supplied.
- [x] Focused regression tests pass.
- [x] Production build passes and `engui-studio.service` is restarted.

## Rollback

Revert the implementation commit, rebuild the app, and restart `engui-studio.service`.

## Result

New Video Sequence Builder segments now default to deterministic generation with `seed = 40` and `randomizeSeed = false`, including segments inserted from templates.
