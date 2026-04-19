---
id: ENGUI-127
title: Optimize video job cards with posters instead of inline video loads
status: Planned
assignee: []
created_date: '2026-04-19 07:01'
labels:
  - jobs
  - video
  - performance
  - mobile
  - ux
dependencies:
  - ENGUI-126
references:
  - /home/engui/Engui_Studio/src/components/layout/RightPanel.tsx
  - /home/engui/Engui_Studio/src/components/workspace/JobDetailsDialog.tsx
  - /home/engui/Engui_Studio/src/app/api/jobs/[id]/route.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The image-preview rollout intentionally focused on completed image jobs. Video job cards in the jobs list still mount inline `<video>` elements, which means they can continue to trigger heavier media loading than necessary during list scrolling, especially on mobile.

Follow up by introducing lightweight poster behavior for completed video jobs so the jobs list can stay cheap to scroll while the details dialog and fullscreen/open flows continue to use the original video output.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Jobs list cards for completed video jobs render from a lightweight poster/thumbnail path instead of mounting the full video element by default
- [ ] #2 Opening a completed video job still uses the original video output in details/fullscreen contexts
- [ ] #3 The solution has a safe fallback for older video jobs without poster data
- [ ] #4 Desktop and mobile jobs-list scrolling are smoke-tested after the change
<!-- AC:END -->
