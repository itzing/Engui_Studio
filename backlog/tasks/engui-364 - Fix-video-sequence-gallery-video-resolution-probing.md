---
id: engui-364
title: Fix video sequence Gallery video resolution probing
status: done
created: 2026-07-09
updated: 2026-07-09
---

## Goal

Prevent Gallery video source selection from writing invalid sequence dimensions such as `0x1` or `1280x1`.

## Acceptance Criteria

- [x] Video metadata probing reads the actual first video stream dimensions instead of the first incidental `NxN` token in FFmpeg stderr.
- [x] Rotation metadata is handled so displayed portrait/landscape dimensions are correct.
- [x] Regression tests cover misleading FFmpeg text like `0x1` before the real stream resolution.
- [x] Existing affected sequences are corrected from their source video metadata.
- [x] Focused tests, production build, service restart, and smoke checks pass.

## Result

Gallery video sequence resolution probing now uses `ffprobe` JSON for the first video stream and falls back to FFmpeg stderr parsing that only accepts dimensions from the video stream line. Rotation metadata swaps displayed dimensions for 90/270-degree sources. This prevents incidental metadata text such as `0x1` from being stored as sequence dimensions.
