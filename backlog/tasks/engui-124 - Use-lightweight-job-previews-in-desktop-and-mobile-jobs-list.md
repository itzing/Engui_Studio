---
id: ENGUI-124
title: Use lightweight job previews in desktop and mobile jobs list
status: Planned
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
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Switch jobs-list rendering to use the lightweight preview asset instead of the full completed result wherever the UI is showing a small card-sized visual.

Keep full-resolution media for detail/open/download flows, but ensure both desktop and mobile jobs list cards prefer the lightweight preview field with a safe fallback to the original result when older jobs do not have a generated preview yet.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Jobs data flow exposes the preview field consistently to the React jobs state used by the list UI
- [ ] #2 Desktop jobs cards render the lightweight preview for completed image jobs when available
- [ ] #3 Mobile jobs cards render the lightweight preview for completed image jobs when available
- [ ] #4 Jobs details, drag-and-drop, full preview, and download flows continue to use the original `resultUrl` rather than the lightweight preview
- [ ] #5 Older jobs without a generated preview still render correctly via fallback without breaking non-image job types
<!-- AC:END -->
