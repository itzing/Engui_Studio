# ENGUI-408 - Open Gallery carousel in fullscreen modal

status: done
labels: [gallery, desktop, video, viewer, modal]

## Goal

Open the desktop Gallery Carousel as a fullscreen modal instead of replacing the Gallery grid content area.

## Scope

- Keep the feature desktop-only.
- Replace the inline `Grid / Carousel` content switch with a Gallery sidebar action that opens Carousel.
- Render `GalleryVideoCarousel` in a fullscreen modal layer above the Gallery overlay.
- Close the carousel modal with Escape without closing the Gallery overlay.
- Add an explicit close action in the carousel header.
- Preserve existing carousel playback behavior, no-repeat feed, edge-to-edge spacing, full-height scaling, muted autoplay, click pause/resume, speed slider, and end-of-feed behavior.

## Validation

- Focused component tests for Escape behavior and modal opening.
- Existing carousel helper/component tests.
- Targeted lint for touched files.
- Production build, service restart, and route smoke checks.
