---
id: engui-365
title: Auto-sync video sequence completed jobs
status: Done
created: 2026-07-09
updated: 2026-07-09
---

## Goal

Make desktop Video Sequence Builder automatically pick up completed segment generation jobs without requiring the manual Refresh status button.

## Acceptance Criteria

- [x] Active Video Sequence Builder polls queued/processing segments that have a generation job id.
- [x] A completed job updates its segment status and `outputVideoUrl` automatically through the existing status sync path.
- [x] Automatic sync keeps the existing first/last frame extraction behavior.
- [x] Polling is best-effort and does not launch new RunPod jobs.
- [x] Focused regression tests pass.
- [x] Production build passes and `engui-studio.service` is restarted.

## Rollback

Revert the implementation commit, rebuild the app, and restart `engui-studio.service`.

## Result

Desktop Video Sequence Builder now quietly polls active queued/processing generated segments and calls the existing segment status sync endpoint. When the underlying job reaches `completed`, the segment imports the job output into `outputVideoUrl` and keeps the automatic first/last frame extraction path. Manual Refresh remains available as an explicit fallback, but normal completed jobs should appear without clicking it.
