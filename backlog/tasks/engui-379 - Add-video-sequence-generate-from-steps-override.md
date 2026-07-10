---
id: engui-379
title: Add video sequence generate-from steps override
status: Done
created: 2026-07-10
updated: 2026-07-10
---

## Goal

Allow desktop Video Sequence Builder users to set one steps override before running Generate from selected segment.

## Acceptance Criteria

- [x] Generate from selected segment opens a confirmation modal before queueing.
- [x] The modal shows how many draft, failed, or stale segments from the selected segment forward will be regenerated.
- [x] The modal lets the user set a positive steps override.
- [x] Every eligible segment in that generate-from range uses the override instead of its own saved steps.
- [x] Focused regression tests pass.
- [x] Production build passes and `engui-studio.service` is restarted.

## Rollback

Revert the implementation commit, rebuild the app, and restart `engui-studio.service`.

## Result

Desktop Generate from selected now opens a modal that lists draft, failed, and stale segments from the selected segment forward and accepts a steps override. The backend validates the override, applies it to every eligible segment in that range, and uses it for the queued segment payload.
