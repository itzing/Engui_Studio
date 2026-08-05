---
id: engui-377
title: Add WAN22 looped video toggle
status: Done
created: 2026-08-05
updated: 2026-08-05
---

## Goal

Add a shared desktop and mobile Create Video control for Wan 2.2 looped output. When enabled, Engui sends a `looped` flag so the DaSiWa endpoint can condition the clip on the same source image as both the first and last frame.

## Acceptance Criteria

- [x] Desktop Create Video exposes a Wan 2.2 `Looped` checkbox.
- [x] Mobile Create Video exposes the same shared `Looped` checkbox.
- [x] Wan 2.2 submissions include `looped: true` when enabled.
- [x] The setting persists through existing video drafts and presets.
- [x] Focused regression tests pass.
- [x] Production build passes and `engui-studio.service` is restarted.

## Rollback

Revert the implementation commit, rebuild the app, and restart `engui-studio.service`.

## Result

Shared Create Video now exposes a Wan 2.2 `Looped` checkbox on desktop and mobile. When enabled, Engui sends `looped: true` through `/api/generate` and the secure RunPod payload.
