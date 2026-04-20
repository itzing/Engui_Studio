---
id: engui-143
title: Add mobile detail routes for jobs and gallery
status: done
priority: medium
labels: [mobile, jobs, gallery, details]
created_at: 2026-04-20
updated_at: 2026-04-20
completed_at: 2026-04-20
assignee: openclaw
---

## Summary

Add dedicated detail routes for mobile Jobs and Gallery so important item inspection and actions are handled as full mobile screens rather than desktop-style dialogs.

## Desired outcome

Jobs and Gallery details feel native to the route-based mobile app and do not inherit dialog-heavy desktop behavior.

## Acceptance criteria

- [x] `/m/jobs/[id]` exists as a mobile detail route
- [x] `/m/gallery/[id]` exists as a mobile detail route
- [x] Mobile back navigation works predictably from detail screens
- [x] Required actions remain available on detail screens
- [x] Desktop dialogs remain unchanged

## Completion notes

Completed by adding route-native mobile detail pages for jobs and gallery assets under `/m/jobs/[id]` and `/m/gallery/[id]`. Added dedicated mobile detail hooks and screens, plus a new GET detail handler for `/api/gallery/assets/[id]`. Mobile list taps now push into these detail routes instead of bouncing through the temporary Preview-only path, while desktop job/gallery dialogs remain unchanged.

