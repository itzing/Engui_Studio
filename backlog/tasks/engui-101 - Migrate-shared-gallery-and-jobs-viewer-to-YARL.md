---
id: ENGUI-101
title: Migrate shared gallery and jobs viewer to YARL
status: Done
assignee: []
created_date: '2026-05-01 19:42'
labels: []
dependencies:
  - ENGUI-100
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the shared `GalleryFullscreenViewer` implementation with a `yet-another-react-lightbox` based wrapper while preserving the existing host contract used by gallery and jobs surfaces. First implementation pass should keep controlled index/open state, info action, host header/footer slots, zoom, swipe navigation, desktop keyboard behavior, and a clear path for restoring custom slideshow and favorite UX parity.
<!-- SECTION:DESCRIPTION:END -->
