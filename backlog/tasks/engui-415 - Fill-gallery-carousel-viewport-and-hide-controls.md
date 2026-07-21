# ENGUI-415 - Fill Gallery carousel viewport and hide controls

status: done
labels: [gallery, desktop, video, image, viewer, controls, fullscreen]

## Goal

Make the desktop fullscreen Gallery Carousel use the full browser viewport height and let the user hide carousel controls for an unobstructed cinema-style view.

## Scope

- Keep the change desktop-only.
- Make the carousel scene fill the fullscreen modal viewport height instead of staying inside a 16:9 box.
- Keep card dimensions proportional by deriving width from viewport scene height and media aspect ratio.
- Render the header, status, Images toggle, speed, Shuffle, Refresh, and Close controls as an overlay above the scene.
- Add a `Hide UI` control.
- Add `H` as a keyboard shortcut to hide/reveal controls.
- Reveal controls when the pointer moves over the carousel.
- Preserve Escape close, Space pause/resume, ArrowLeft/ArrowRight held scrubbing, drag scrubbing, Images, Shuffle, Refresh, and bidirectional tape behavior.

## Validation

- Focused component coverage for viewport-height scene layout and hide/reveal controls.
- Focused carousel test suite.
- Targeted lint for touched files.
- Production build, service restart, and route smoke checks.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify the Gallery Carousel opens with the previous 16:9 scene layout.

## Result

Implemented for the desktop fullscreen Gallery Carousel. The scene now fills the modal viewport height, controls float as an overlay, and the overlay can be hidden with `Hide UI` or `H` and revealed again with pointer movement or `H`.
