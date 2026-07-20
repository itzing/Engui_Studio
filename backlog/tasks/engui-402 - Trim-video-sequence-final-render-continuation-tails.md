---
id: engui-402
title: Trim video sequence final render continuation tails
status: Done
created: 2026-07-20
updated: 2026-07-20
labels: [video-sequences, final-render, desktop]
priority: high
---

## Goal

Make final Video Sequence rendering use the same continuation boundary as automatic previous-last-frame extraction.

## Acceptance Criteria

- [x] Final render trims every non-final segment at the same `duration - 3/fps` timestamp used for `lastFrameUrl` when metadata is available.
- [x] The last segment remains untrimmed.
- [x] Final render falls back to full segment concat when duration/FPS metadata is missing or the clip is too short.
- [x] Render output hashing includes the trim plan so fixed renders get a new final video URL.
- [x] Focused regression tests pass.
- [x] Production build passes and `engui-studio.service` is restarted.

## Rollback

Revert the implementation commit, rebuild the app, and restart `engui-studio.service`.

## Result

Final render now prepares a trim plan from segment output metadata. Every non-final segment is cut at the continuation frame timestamp before concatenation, while the final segment stays full length. The concat helper normalizes prepared inputs through FFmpeg when any trim is required, avoiding mixed-codec concat failures, and render hashes include the trim plan.
