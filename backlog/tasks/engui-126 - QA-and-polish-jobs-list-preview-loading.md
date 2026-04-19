---
id: ENGUI-126
title: QA and polish jobs-list preview loading
status: Planned
assignee: []
created_date: '2026-04-19 06:30'
labels:
  - jobs
  - qa
  - mobile
  - performance
  - ux
dependencies:
  - ENGUI-123
  - ENGUI-124
references:
  - /home/engui/Engui_Studio/src/components/layout/RightPanel.tsx
  - /home/engui/Engui_Studio/src/components/workspace/JobDetailsDialog.tsx
  - /home/engui/Engui_Studio/src/lib/context/StudioContext.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Run a focused QA and polish pass on the new jobs-list preview flow after lightweight image previews are introduced.

Validate that the jobs list feels lighter on mobile, completed jobs still open their real outputs in details/fullscreen contexts, fallback behavior works for older jobs, and any remaining follow-up work such as video poster optimization is captured explicitly rather than mixed into the image-preview rollout.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Desktop and mobile jobs lists render completed image jobs from the lightweight preview path without visual regressions
- [ ] #2 Opening a completed job from the list still shows the original output rather than the lightweight preview artifact
- [ ] #3 A mixed dataset of new preview-backed jobs and older fallback jobs behaves correctly
- [ ] #4 Fast scrolling on mobile no longer shows the obvious full-resolution image loading behavior that motivated the change
- [ ] #5 Any remaining out-of-scope follow-ups, including video poster optimization if still needed, are documented separately
<!-- AC:END -->
