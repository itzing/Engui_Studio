---
id: ENGUI-358
title: Add manual frame picker for video sequences
status: Done
assignee:
  - Rocky
created_date: '2026-07-09 10:52'
updated_date: '2026-07-09 11:02'
labels: []
dependencies: []
priority: high
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Add a desktop Segment inspector frame picker for `Manual frame`.
- [x] #2 The picker opens a modal with the previous segment output video, a time slider, and a `Pick frame` confirmation action.
- [x] #3 Picking a frame extracts the chosen timestamp into a local frame image and applies it to the current segment as `manual_frame` source.
- [x] #4 Block clearly when there is no previous segment output video or FFmpeg cannot extract a frame.
- [x] #5 Keep changes desktop-only, avoid live RunPod jobs, pass focused tests/build, and restart Engui service.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope is the desktop `/video-sequences` Segment inspector manual-frame source flow. Rollback: revert the implementation commit, rebuild, and restart `engui-studio.service`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a desktop Manual frame picker to the Video Sequence Builder Segment inspector. The Source section now opens a modal with the previous segment output video, a seek slider, current timestamp display, and `Pick frame`; the server extracts the selected timestamp with FFmpeg, stores it under the sequence frame folder, and applies it to the selected segment as `manual_frame` with `sourceImageUrl`, `sourceSegmentId`, and `sourceFrameRole: custom`.
<!-- SECTION:FINAL_SUMMARY:END -->
