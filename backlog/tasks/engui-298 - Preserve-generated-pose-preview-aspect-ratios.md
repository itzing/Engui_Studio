---
id: ENGUI-298
title: Preserve generated pose preview aspect ratios
status: Done
assignee: []
created_date: '2026-05-08 13:59'
updated_date: '2026-05-08 13:59'
labels:
  - studio-sessions
  - pose-library
  - ui
  - bug
dependencies: []
priority: high
completed_date: '2026-05-08 14:00'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pose preview candidate/detail rendering should use original generated preview assets and natural image aspect ratios, not thumbnail/fixed-square display. Keep tile fit behavior without cropping.
<!-- SECTION:DESCRIPTION:END -->

## Resolution

- Primary pose preview URLs now prefer original generated `assetUrl` over thumbnails.
- Pose detail primary preview renders with natural image aspect ratio (`h-auto`) instead of a forced fixed aspect box.
- Preview candidates render original `assetUrl` first and use natural image aspect ratio, keeping compact card width.
- Pose/category tiles still fit images in their tile containers without cropping.
- Validation: production build passed.
