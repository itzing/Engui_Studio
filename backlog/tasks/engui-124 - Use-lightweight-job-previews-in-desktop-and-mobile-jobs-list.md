---
id: ENGUI-124
title: Use lightweight job previews in desktop and mobile jobs list
status: Done
assignee: []
created_date: '2026-04-19 06:29'
labels:
  - jobs
  - frontend
  - mobile
  - performance
  - ux
dependencies:
  - ENGUI-123
references:
  - /home/engui/Engui_Studio/src/app/api/jobs/route.ts
  - /home/engui/Engui_Studio/src/lib/context/StudioContext.tsx
  - /home/engui/Engui_Studio/src/components/layout/RightPanel.tsx
  - /home/engui/Engui_Studio/src/components/workspace/JobDetailsDialog.tsx
priority: high
updated_date: '2026-04-19 06:49'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Switch jobs-list rendering to use the lightweight preview asset instead of the full completed result wherever the UI is showing a small card-sized visual.

Keep full-resolution media for detail/open/download flows, but ensure both desktop and mobile jobs list cards prefer the lightweight preview field with a safe fallback to the original result when older jobs do not have a generated preview yet.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Jobs data flow exposes the preview field consistently to the React jobs state used by the list UI
- [x] #2 Desktop jobs cards render the lightweight preview for completed image jobs when available
- [x] #3 Mobile jobs cards render the lightweight preview for completed image jobs when available
- [x] #4 Jobs details, drag-and-drop, full preview, and download flows continue to use the original `resultUrl` rather than the lightweight preview
- [x] #5 Older jobs without a generated preview still render correctly via fallback without breaking non-image job types
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed the jobs-list UI rollout for lightweight previews. Added `thumbnailUrl` to the shared React `Job` shape, extended read-only status payloads so in-flight polling can pick up local thumbnail data on completion, and updated `RightPanel` job cards to prefer `thumbnailUrl` for completed image jobs on both desktop and mobile while keeping `resultUrl` for drag-and-drop, details, and download flows. Older jobs continue to fall back to `resultUrl` automatically when no thumbnail is present. Verified with tests, build, restart, and `HTTP 200`.
<!-- SECTION:FINAL_SUMMARY:END -->
