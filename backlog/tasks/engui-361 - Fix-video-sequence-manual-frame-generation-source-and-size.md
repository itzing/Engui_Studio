---
id: engui-361
title: Fix video sequence manual frame generation source and size
status: done
created: 2026-07-09
updated: 2026-07-09
---

## Goal

Fix desktop Video Sequence Builder generation so a segment using `manual_frame` sends the picked frame as the WAN22 source image and preserves the sequence portrait resolution instead of falling back to landscape defaults.

## Acceptance Criteria

- [x] Manual frame generation resolves `sourceImageUrl` before any linked `sourceSegmentId` frame fallback.
- [x] WAN22 segment generation includes sequence `width` and `height` when generation options do not explicitly override them.
- [x] Regression coverage proves a manual frame with a linked source segment sends the picked frame and portrait dimensions.
- [ ] Production build passes and `engui-studio.service` is restarted.

## Result

Manual-frame generation now uses the picked `sourceImageUrl` directly instead of resolving through the linked previous segment. WAN22 generation payloads also include dimensions: explicit generation options still win, otherwise the sequence size is used, and existing default-landscape sequences can fall back to the picked source frame dimensions when available.
