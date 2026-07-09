---
id: engui-371
title: Remove dimension input step restrictions
status: Done
created: 2026-07-09
updated: 2026-07-09
---

## Goal

Let users type arbitrary width and height values in Engui Create forms without browser-side step validation blocking values such as `720`.

## Acceptance Criteria

- [x] Desktop Create Image width/height inputs accept arbitrary numeric values.
- [x] Desktop Create Video width/height inputs accept arbitrary numeric values.
- [x] Mobile Create advanced width/height inputs accept arbitrary numeric values.
- [x] Aspect-ratio preset helpers no longer round generated dimensions to a `64`-pixel step.
- [x] Focused regression tests pass.
- [x] Production build passes and `engui-studio.service` is restarted.

## Rollback

Revert the implementation commit, rebuild the app, and restart `engui-studio.service`.

## Result

Create Image, Create Video, and mobile Create advanced width/height inputs no longer emit browser `min`, `max`, or `64`-pixel `step` constraints. Dimension inputs use `step="any"`, so values such as `720` are accepted by the browser before submission.
