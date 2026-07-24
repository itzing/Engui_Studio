# ENGUI-449 - Autoplay Gallery viewer videos with tap controls

Status: Done
Created: 2026-07-24T07:54:32Z
Finished: 2026-07-24T08:01:00Z

## Goal

Make Gallery fullscreen viewer videos start playing immediately while swiping through assets, loop continuously, and keep native video controls hidden until the user taps the video.

## Scope

- Shared `GalleryFullscreenViewer`, covering mobile, tablet/iPad, and desktop Gallery fullscreen viewing.
- Video slides only.
- Preserve existing image/audio viewer behavior and Gallery details pages.

## Acceptance Criteria

- [x] When the active Gallery fullscreen item is a video, playback starts automatically.
- [x] Active Gallery fullscreen videos loop.
- [x] Native video controls are hidden by default after opening or swiping to a video.
- [x] Tapping the active video reveals native controls.
- [x] Leaving a video and returning starts from the beginning with controls hidden again.
- [x] Focused component tests cover the video attributes and tap-to-show controls behavior.

## Validation

- Focused `GalleryFullscreenViewer` tests: pass.
- Targeted ESLint on touched files: pass.
- `git diff --check`: pass.
- `npx prisma validate`: pass.
- `npm run build`: pass.
- Restarted `engui-studio.service`: active on port 3010.
- Smoke checks for `/`, `/m/gallery`, `/m/create`, and `/api/jobs`: 200.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify Gallery fullscreen videos return to always-visible native controls.
