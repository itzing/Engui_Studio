---
id: engui-143
title: Add mobile detail routes for jobs and gallery
status: open
priority: medium
labels: [mobile, jobs, gallery, details]
created_at: 2026-04-20
updated_at: 2026-04-20
assignee: openclaw
---

## Summary

Add dedicated detail routes for mobile Jobs and Gallery so important item inspection and actions are handled as full mobile screens rather than desktop-style dialogs.

## Desired outcome

Jobs and Gallery details feel native to the route-based mobile app and do not inherit dialog-heavy desktop behavior.

## Acceptance criteria

- [ ] `/m/jobs/[id]` exists as a mobile detail route
- [ ] `/m/gallery/[id]` exists as a mobile detail route
- [ ] Mobile back navigation works predictably from detail screens
- [ ] Required actions remain available on detail screens
- [ ] Desktop dialogs remain unchanged
