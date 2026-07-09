---
id: engui-370
title: Add sequence delete and WAN22 Create Video defaults
status: Done
created: 2026-07-09
updated: 2026-07-09
---

## Goal

Add a desktop Video Sequence Builder sequence delete action and update WAN2.2 Create Video defaults.

## Acceptance Criteria

- [x] `/video-sequences` exposes a sequence delete button for the active sequence.
- [x] Sequence deletion asks for confirmation before deleting.
- [x] After deletion, the UI refreshes to another sequence or an empty state.
- [x] WAN2.2 Create Video defaults to `steps: 4`.
- [x] WAN2.2 Create Video defaults to `length: 80` frames (`16fps * 5s`).
- [x] Focused regression tests pass.
- [x] Production build passes and `engui-studio.service` is restarted.

## Rollback

Revert the implementation commit, rebuild the app, and restart `engui-studio.service`.

## Result

The Video Sequence Builder header now has a confirmed delete action for the active sequence, backed by the existing sequence delete API. WAN2.2 Create Video keeps `steps: 4` and now defaults `length` to `80` frames with a compatible minimum.
