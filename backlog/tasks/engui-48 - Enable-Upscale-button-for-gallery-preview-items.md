---
id: ENGUI-48
title: Enable Upscale button for gallery preview items
status: In Progress
assignee: []
created_date: '2026-04-12 14:27'
updated_date: '2026-04-12 14:27'
labels:
  - engui
  - ui
  - gallery
  - image-panel
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Enable the Upscale action in the main image panel for gallery preview items as well, not only job previews.

Requirements:
- Show an `Upscale` action for gallery preview images in the center panel.
- Reuse the existing upscale flow as closely as possible.
- If gallery items need a different backend lookup or payload, wire that explicitly rather than hiding the action.
- Build, verify, and ship with the current Engui deployment flow.
<!-- SECTION:DESCRIPTION:END -->
