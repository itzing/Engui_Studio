---
id: engui-147
title: Rework mobile jobs list and viewer flow
status: in_progress
priority: high
labels: [mobile, jobs, pwa]
created_at: 2026-04-20
updated_at: 2026-04-20
assignee: openclaw
---

## Summary

Rework the route-based mobile jobs screen so it behaves like a touch-first selectable virtual list instead of a grouped card list.

## Desired outcome

Mobile jobs use a fixed-count virtual list with sparse page loading, preserve selection and viewer restore behavior, and expose compact overlay actions on the selected item.

## Acceptance criteria

- [ ] Mobile jobs use a fixed-count virtual list with placeholder rows for unloaded entries
- [ ] Page size is 10 jobs
- [ ] First tap selects a job
- [ ] Second tap on the selected job opens the viewer
- [ ] Viewer navigation updates the selected job
- [ ] Returning from viewer restores focus to the selected job row
- [ ] Toolbar only shows refresh and clear finished actions
- [ ] Selected item shows overlay actions for delete and upscale
- [ ] Prompt text is removed from the mobile jobs row metadata
