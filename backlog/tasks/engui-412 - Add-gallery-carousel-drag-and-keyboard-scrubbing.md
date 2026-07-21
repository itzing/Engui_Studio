# ENGUI-412 - Add Gallery carousel drag and keyboard scrubbing

status: done
labels: [gallery, desktop, video, image, viewer, controls]

## Goal

Add manual tape scrubbing to the desktop fullscreen Gallery Carousel so the user can drag the tape left/right, scrub with header buttons, and toggle pause with Space.

## Scope

- Keep the change desktop-only.
- Dragging the carousel scene moves the current tape slots left/right.
- Dragging works while movement is already paused.
- Starting a real drag pauses carousel movement.
- Releasing after a drag keeps movement paused.
- Header left/right buttons move the tape in fixed steps and keep movement paused.
- Space toggles carousel movement pause/resume.
- Space does not steal input from checkboxes, sliders, buttons, text inputs, or editable elements.
- Preserve visible video playback and image cycling while movement is paused.
- Preserve Images toggle, fullscreen modal close, Escape close, speed, Shuffle, Refresh, edge-to-edge spacing, and full-height scaling behavior.

## Validation

- Focused component tests for drag-to-pause, header scrub buttons, and Space pause toggle.
- Focused carousel test suite.
- Targeted lint for touched files.
- Production build, service restart, and route smoke checks.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify the Gallery Carousel returns to click-only pause/resume.

## Result

Implemented for the desktop fullscreen Gallery Carousel. The scene now supports pointer drag scrubbing left/right; a real drag pauses movement and leaves movement paused after release. Header left/right buttons scrub the tape in fixed steps and leave movement paused. Space toggles movement pause/resume while ignoring form controls, buttons, sliders, and editable elements. Visible videos keep playing and visible image slots keep cycling while movement is paused.
