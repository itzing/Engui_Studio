---
id: ENGUI-322
title: Show I2I source thumbnail in job detail
status: Done
assignee: []
created_date: '2026-05-12 19:32'
labels: []
dependencies:
  - ENGUI-320
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Surface I2I source metadata in job history without cluttering the main job card. The main card should remain unchanged, while job detail or expanded view should show a small source thumbnail and basic I2I metadata.
<!-- SECTION:DESCRIPTION:END -->

## Scope

- Job metadata read/display path.
- Job detail/expanded view UI.
- Source thumbnail display using stored `sourcePreviewUrl`.

## Acceptance Criteria

- Main job cards do not show an I2I source thumbnail.
- Job detail/expanded view shows a small source thumbnail for I2I jobs when available.
- Job detail shows basic I2I metadata: long side, denoise, and prepared dimensions.
- Non-I2I jobs remain unchanged.
- Gallery behavior remains manual-only; I2I results are not auto-saved to Gallery.

## Implementation Notes

<!-- SECTION:IMPLEMENTATION-NOTES:BEGIN -->
Implemented in the current Z-Image I2I change set. Verified with endpoint Python compile/workflow structural check, Engui targeted lint, production build, and Engui service restart.
<!-- SECTION:IMPLEMENTATION-NOTES:END -->
