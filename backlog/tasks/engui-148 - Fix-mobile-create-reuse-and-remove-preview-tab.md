---
id: engui-148
title: Fix mobile create reuse and remove preview tab
status: in_progress
priority: high
labels: [mobile, create, jobs, pwa]
created_at: 2026-04-20
updated_at: 2026-04-20
assignee: openclaw
---

## Summary

Fix the broken mobile create reuse flow, make Clear finished actually clear completed and failed jobs with confirmation, remove the obsolete Preview tab, and add a job-details info action inside the mobile jobs viewer.

## Desired outcome

Mobile users can reliably jump from jobs back into Create with the correct model and fields restored, destructive bulk actions are confirmed, the bottom nav no longer includes the legacy Preview tab, and the fullscreen job viewer exposes a direct path to Job details.

## Acceptance criteria

- [ ] Reuse from mobile jobs restores the correct create model and draft fields
- [ ] Clear finished asks for confirmation and deletes completed plus failed jobs in the current workspace
- [ ] Mobile bottom navigation no longer shows a Preview tab
- [ ] The legacy `/m/preview` entry no longer acts as a first-class mobile destination
- [ ] Mobile jobs fullscreen viewer shows an info button that opens job details
