---
id: ENGUI-304
title: Polish Studio pose breadcrumbs and run screen
status: Done
assignee: []
created_date: '2026-05-08 17:09'
labels:
  - studio-sessions
  - ui
  - desktop
  - mobile
priority: high
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Polish the Studio UI: pose category breadcrumbs should show real category names, run detail should focus on shot tiles only, and run settings should move into a slide-over side panel with ControlNet strength included.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

- Pose Library category/pose breadcrumbs show the real category name instead of the literal word `Category`.
- Run detail main content shows shot tiles/results, not an inline run settings card.
- Draft shot tiles display pose preview when present, otherwise the assigned pose name.
- Run settings are available from a side panel/drawer.
- ControlNet strength is visible in run settings.
- Build passes, changes are committed/pushed, and `engui-studio.service` is restarted.

## Implementation Notes

- Loaded pose categories on the F-Studio shell and resolved Pose Library breadcrumbs by category id.
- Reworked run detail into shot/result tile grids with pose preview fallback to pose name.
- Moved run settings into a responsive right-side slide-over and added editable `controlnet_strength`.
