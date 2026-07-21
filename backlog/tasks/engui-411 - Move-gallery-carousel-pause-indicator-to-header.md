# ENGUI-411 - Move Gallery carousel pause indicator to header

status: done
labels: [gallery, desktop, video, image, viewer, ui]

## Goal

Move the desktop Gallery Carousel `Paused` indicator out of the carousel scene and into the top panel so the moving tape is never covered by a pause overlay.

## Scope

- Keep the change desktop-only.
- Preserve motion-only pause behavior from ENGUI-410.
- Remove the central paused overlay from the 16:9 carousel scene.
- Show a compact paused indicator in the carousel header/top panel.
- Keep visible videos playing and visible image slots cycling while movement is paused.
- Preserve Images toggle, fullscreen modal close, Escape close, speed, Shuffle, Refresh, edge-to-edge spacing, and full-height scaling behavior.

## Validation

- Focused component test for the header pause indicator.
- Focused carousel test suite.
- Targeted lint for touched files.
- Production build, service restart, and route smoke checks.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify the previous centered pause overlay returns.

## Result

Implemented for the desktop fullscreen Gallery Carousel. The `Paused` indicator now appears as a compact header badge next to the carousel title, and the centered paused overlay was removed from the 16:9 scene so it no longer covers the tape.
