---
id: ENGUI-353
title: Add video sequence final render
status: Done
assignee:
  - Rocky
created_date: '2026-07-09 06:34'
updated_date: '2026-07-09 06:42'
labels: []
dependencies: []
priority: medium
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Add POST /api/video-sequences/:id/render for FFmpeg concat of completed local segment videos.
- [x] #2 Reject render when any segment is draft, queued, processing, failed, stale, missing output, or non-local video.
- [x] #3 Store finalVideoUrl on the sequence and keep segments unchanged.
- [x] #4 Connect desktop /video-sequences Render final action and final video preview link.
- [x] #5 Add focused tests and pass production build.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope is desktop Video Sequences only. Do not launch live RunPod validation jobs. Rollback: revert the implementation commit, rebuild, and restart engui-studio.service.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented final render for desktop Video Sequences: POST /api/video-sequences/:id/render validates that every segment is completed with a local output video, concatenates segment clips via FFmpeg, stores finalVideoUrl on the sequence, and exposes Render final plus a final video link in the desktop UI. Added focused render success and blocking tests.
<!-- SECTION:FINAL_SUMMARY:END -->
