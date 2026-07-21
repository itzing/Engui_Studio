# ENGUI-413 - Use held keyboard arrows for Gallery carousel scrubbing

status: done
labels: [gallery, desktop, video, image, viewer, controls]

## Goal

Replace the desktop fullscreen Gallery Carousel header scrub buttons with physical keyboard arrow scrubbing.

## Scope

- Keep the change desktop-only.
- Remove the visual left/right scrub buttons from the carousel header.
- Holding ArrowLeft scrubs the tape backward.
- Holding ArrowRight scrubs the tape forward.
- Keyboard scrubbing moves at double the current carousel playback speed.
- Releasing the held arrow key stops keyboard scrubbing.
- Arrow shortcuts do not steal focus behavior from buttons, checkboxes, sliders, text inputs, or editable elements.
- Preserve Space pause/resume.
- Preserve drag scrubbing, including drag-to-pause and pause retention after drag release.
- Preserve visible video playback and image cycling while movement is paused.
- Preserve Images toggle, fullscreen modal close, Escape close, speed, Shuffle, Refresh, edge-to-edge spacing, and full-height scaling behavior.

## Validation

- Focused component tests for held arrow-key scrubbing, stopping on key release, and shortcut ignore behavior.
- Focused carousel test suite.
- Targeted lint for touched files.
- Production build, service restart, and route smoke checks.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify the Gallery Carousel opens normally.

## Result

Implemented for the desktop fullscreen Gallery Carousel. The header no longer shows visual left/right scrub buttons. Holding physical ArrowLeft/ArrowRight keys scrubs the tape backward/forward at double the current speed; key release stops keyboard scrubbing. Space pause/resume and drag scrubbing behavior remain intact.
