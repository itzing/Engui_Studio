# Gallery Viewer Video Autoplay Tap Controls Plan

## Context

Gallery fullscreen viewing uses the shared `GalleryFullscreenViewer` on mobile, tablet/iPad, and desktop. Video slides currently render native controls immediately, which darkens the video when users swipe to a video.

## Plan

1. Keep the change in the shared fullscreen viewer so all Gallery surfaces inherit the same behavior.
2. Make active video slides autoplay, loop, play inline, and stay muted for browser autoplay compatibility.
3. Hide native video controls by default for each newly active video.
4. Reveal native controls after the user taps the active video.
5. Reset video playback and hidden-control state when navigating away from a video.

## Validation

- Focused `GalleryFullscreenViewer` Vitest coverage for autoplay attributes and tap-to-show controls.
- Targeted ESLint on touched files.
- `git diff --check`.
- `npx prisma validate`.
- Production build and `engui-studio.service` restart.
- Smoke checks for Gallery routes and API.
