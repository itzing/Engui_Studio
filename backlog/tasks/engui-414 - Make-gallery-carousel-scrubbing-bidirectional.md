# ENGUI-414 - Make Gallery carousel scrubbing bidirectional

status: done
labels: [gallery, desktop, video, image, viewer, controls]

## Goal

Make desktop fullscreen Gallery Carousel manual scrubbing continuous in both directions, without black empty space when the user scrolls backward.

## Scope

- Keep the change desktop-only.
- Preserve the current shuffled feed order.
- Track each carousel slot's feed index.
- Restore previously played slots to the right side when scrubbing backward.
- Restore upcoming slots to the left side when scrubbing forward.
- Keep a bounded active slot window so offscreen media does not grow without limit.
- Preserve held ArrowLeft/ArrowRight double-speed scrubbing.
- Preserve drag scrubbing, including drag-to-pause and pause retention after drag release.
- Preserve Space pause/resume.
- Preserve visible video playback and image cycling while movement is paused.
- Preserve Images toggle, fullscreen modal close, Escape close, speed, Shuffle, Refresh, edge-to-edge spacing, and full-height scaling behavior.

## Validation

- Focused component test for restoring previously played clips after backward scrubbing.
- Focused carousel test suite.
- Targeted lint for touched files.
- Production build, service restart, and route smoke checks.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify the Gallery Carousel opens normally.

## Result

Implemented for the desktop fullscreen Gallery Carousel. Manual scrubbing now keeps a bidirectional slot window: when the user drags or holds ArrowLeft back toward already played content, previous feed slots are restored on the right side instead of showing a black gap. Forward scrubbing continues restoring upcoming slots on the left side.
