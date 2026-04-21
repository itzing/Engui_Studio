---
id: ENGUI-162
title: Open failed mobile jobs in details and copy errors
status: done
priority: high
labels: [mobile, jobs, failed, ux]
created_at: 2026-04-21
updated_at: 2026-04-21
completed_at: 2026-04-21
assignee: openclaw
---

## Summary
Make failed jobs on mobile open the job details screen on tap and allow copying the error text from the details screen.

## Acceptance criteria
- [x] Tapping a selected failed mobile job opens `/m/jobs/[id]`
- [x] Mobile job details exposes a copy-error action when an error exists
- [x] Build passes

## Completion notes
- updated mobile jobs tap flow so a second tap on the selected failed job opens the dedicated mobile job details route
- added a copy button for the error block in `MobileJobDetailsScreen` using clipboard plus toast feedback
- fixed `/api/jobs/[id]` to return `job.error` so failed mobile details actually receive the error text
- validated with `npm run build`
