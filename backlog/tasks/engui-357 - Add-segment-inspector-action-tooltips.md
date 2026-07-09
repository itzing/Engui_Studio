---
id: ENGUI-357
title: Add segment inspector action tooltips
status: Done
assignee:
  - Rocky
created_date: '2026-07-09 10:44'
updated_date: '2026-07-09 10:50'
labels: []
dependencies: []
priority: medium
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Add detailed hover tooltips and accessible labels to the desktop Segment inspector action buttons.
- [x] #2 Cover Generate, Generate from here, Refresh status, Extract frames, Save template, Delete, and compact inspector header actions.
- [x] #3 Disabled actions still explain what the action does or why it is unavailable.
- [x] #4 Keep changes desktop-only and avoid launching live RunPod jobs.
- [x] #5 Pass focused tests/build and restart Engui service.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope is the desktop `/video-sequences` Segment inspector action controls only. Rollback: revert the implementation commit, rebuild, and restart `engui-studio.service`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added detailed hover tooltips and accessible labels to the desktop Segment inspector action buttons, including Generate, Generate from here, Refresh status, Extract frames, Save template, Delete, Gallery image/video pickers, and compact inspector header actions. Disabled status/frame/gallery-video actions now explain when they become available.
<!-- SECTION:FINAL_SUMMARY:END -->
