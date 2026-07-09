---
id: engui-375
title: Add video sequence clear stale segment action
status: Done
created: 2026-07-09
updated: 2026-07-09
---

## Goal

Let the desktop Video Sequence Builder restore a stale segment back to completed when the user wants to keep its existing output.

## Acceptance Criteria

- [x] A stale segment with an existing output can be marked completed without regenerating.
- [x] The action is exposed in the Segment inspector.
- [x] The action does not delete or rewrite existing output/frame/job metadata.
- [x] Non-stale segments or stale segments without output are rejected by the API.
- [x] Focused regression tests pass.
- [x] Production build passes and `engui-studio.service` is restarted.

## Rollback

Revert the implementation commit, rebuild the app, and restart `engui-studio.service`.

## Result

Stale Video Sequence Builder segments with existing output can now be marked completed again from the Segment inspector without regenerating or rewriting their output/frame/job metadata.
