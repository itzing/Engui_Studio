---
id: ENGUI-296
title: Fit Studio pose tile preview images without cropping
status: Done
assignee: []
created_date: '2026-05-08 13:49'
updated_date: '2026-05-08 13:50'
labels:
  - studio-sessions
  - pose-library
  - ui
  - bug
dependencies: []
priority: medium
completed_date: '2026-05-08 13:51'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pose library tiles currently crop preview images, so portrait/vertical pose previews are cut off inside the tile. Change image rendering so previews fit within the tile while preserving aspect ratio.
<!-- SECTION:DESCRIPTION:END -->

## Resolution

- Pose Library pose tiles now render preview images with `object-contain` instead of `object-cover`.
- Pose detail primary preview, preview candidates, and category cover tiles use the same fit behavior to avoid cropping vertical images.
- Validation: production build passed.
