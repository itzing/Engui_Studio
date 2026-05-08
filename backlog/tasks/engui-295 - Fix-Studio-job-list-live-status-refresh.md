---
id: ENGUI-295
title: Fix Studio job list live status refresh
status: Done
assignee: []
created_date: '2026-05-08 13:46'
updated_date: '2026-05-08 13:47'
labels:
  - studio-sessions
  - jobs
  - bug
  - ui
dependencies: []
priority: high
completed_date: '2026-05-08 13:49'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Studio job lists do not update automatically after jobs are queued or change status; user must manually click refresh to see new jobs or status transitions. Add live polling/revalidation for Studio job list/status surfaces without launching new generation jobs.
<!-- SECTION:DESCRIPTION:END -->

## Resolution

- Desktop/right-panel Jobs now silently refreshes page 1 every 3 seconds while the Jobs panel is visible, so new jobs and DB status transitions appear without clicking Refresh.
- Mobile Jobs now silently refreshes page 1 every 3 seconds, while keeping existing active-job detail polling for loaded jobs.
- Manual refresh/loading state is no longer triggered by background polling, avoiding spinner flicker.
- Validation: targeted Studio tests passed (26 tests) and production build passed.
