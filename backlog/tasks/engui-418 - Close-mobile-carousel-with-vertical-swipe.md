# ENGUI-418 - Close mobile carousel with vertical swipe

status: done
labels: [gallery, mobile, video, viewer, controls, gesture]

## Goal

Remove the visible close button from the mobile landscape Gallery Carousel and let the user exit the fullscreen tape with a vertical swipe up or down.

## Scope

- Mobile landscape Gallery Carousel only.
- Remove the landscape `X` close button from the fullscreen tape.
- Add a vertical swipe gesture that closes the fullscreen overlay and returns to the carousel settings screen.
- Keep horizontal drag scrubbing for the tape.
- Keep tap pause/resume behavior.
- Keep the portrait `Поверните телефон` gate and its `Close` button.
- Preserve desktop Gallery Carousel behavior.

## Validation

- Focused mobile carousel tests for landscape rendering and vertical swipe close.
- Targeted lint for touched files.
- Production build, service restart, and route smoke checks.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify the mobile landscape carousel shows the previous close button.

## Result

Implemented for mobile landscape playback. The visible close button is gone from the fullscreen tape; swiping vertically up or down closes the overlay and returns to settings while horizontal drag remains available for scrubbing.
