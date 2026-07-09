---
id: ENGUI-356
title: Compact video sequence header actions
status: Done
assignee:
  - Rocky
created_date: '2026-07-09 10:36'
updated_date: '2026-07-09 10:43'
labels: []
dependencies: []
priority: medium
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Replace the desktop Video Sequence Builder top action buttons with compact icon buttons.
- [x] #2 Add clear hover tooltips and accessible labels for Save, Generate selected, Generate from here, Refresh status, Render final, and Final video.
- [x] #3 Keep the sequence title and description inputs readable without overlapping toolbar actions.
- [x] #4 Keep changes desktop-only and avoid launching live RunPod jobs.
- [x] #5 Pass focused tests/build and restart Engui service.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope is the desktop `/video-sequences` header toolbar only. Rollback: revert the implementation commit, rebuild, and restart `engui-studio.service`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the desktop Video Sequence Builder header text actions with compact icon buttons. Added detailed hover tooltips and accessible labels for Save, Generate selected, Generate from here, Refresh status, Render final, and Final video, while keeping the title/description inputs on a flexible row so the toolbar does not overlap at narrower desktop widths.
<!-- SECTION:FINAL_SUMMARY:END -->
