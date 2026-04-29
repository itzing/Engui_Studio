---
id: ENGUI-216
title: Backfill upscale bucket for large gallery images
status: In Progress
assignee: []
created_date: '2026-04-29 09:21'
labels:
  - gallery
  - backend
  - desktop
  - mobile
dependencies: []
documentation: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a gallery backfill flow that scans image assets, detects assets larger than the base 1024x1536 resolution, and marks them as bucket `upscale` when they are not already tagged that way.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Backfill scans gallery image assets for a workspace without touching non-image assets
- [ ] #2 Images whose dimensions exceed the 1024x1536 baseline are moved to bucket `upscale` when not already marked
- [ ] #3 Backfill is safe to rerun and skips assets already marked `upscale`
- [ ] #4 Gallery UI exposes a trigger for the upscale bucket backfill and refreshes results afterward
<!-- AC:END -->
