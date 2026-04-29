---
id: ENGUI-216
title: Remove stale jobs from UI when local record is missing
status: In Progress
assignee: []
created_date: '2026-04-29 19:31'
labels:
  - jobs
  - frontend
  - backend
  - mobile
  - desktop
dependencies: []
documentation: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Stop polling and remove stale job cards from desktop and mobile job UIs when the local job record is already missing, and treat cancel/delete 404 responses as successful stale cleanup instead of hard errors.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Desktop jobs polling removes active jobs from local state when `/api/generate/status` returns 404
- [ ] #2 Mobile jobs polling removes active jobs from local state when `/api/generate/status` returns 404
- [ ] #3 Cancel/delete actions treat local 404 as stale cleanup success and remove the visible job card
- [ ] #4 Build passes and deployed UI no longer loops on missing-job 404s
<!-- AC:END -->
