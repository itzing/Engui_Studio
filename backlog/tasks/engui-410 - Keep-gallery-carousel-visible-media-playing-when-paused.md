# ENGUI-410 - Keep Gallery carousel visible media playing when paused

status: done
labels: [gallery, desktop, video, image, viewer]

## Goal

Change desktop Gallery Carousel pause behavior so pause freezes carousel tape movement only. Visible videos should continue playing, and visible image slots should continue cycling.

## Scope

- Keep the change desktop-only.
- Keep click-to-pause/resume for the carousel scene.
- Paused state stops horizontal card movement and feed advancement.
- Paused state does not call `pause()` on visible video elements.
- Visible videos remain muted, looping, and playing while movement is paused.
- Visible image slots continue advancing to the next preselected image once per second while movement is paused.
- Preserve Images toggle, fullscreen modal close, Escape close, speed, Shuffle, Refresh, edge-to-edge spacing, and full-height scaling behavior.

## Validation

- Focused component test for motion-only pause behavior.
- Focused carousel test suite.
- Targeted lint for touched files.
- Production build, service restart, and route smoke checks.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify the Gallery carousel pause behavior returns to the previous full playback pause.

## Result

Implemented for the desktop fullscreen Gallery Carousel. Clicking the carousel now freezes card movement and feed advancement only. Visible muted looping videos continue playing, and visible image slots continue cycling once per second while the tape is paused. The paused overlay/status remains visible as the movement state.
