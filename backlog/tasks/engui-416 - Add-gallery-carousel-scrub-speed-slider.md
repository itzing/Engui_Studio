# ENGUI-416 - Add Gallery carousel scrub speed slider

status: done
labels: [gallery, desktop, video, viewer, controls, keyboard]

## Goal

Make held keyboard scrubbing in the desktop fullscreen Gallery Carousel faster and adjustable.

## Scope

- Keep the change desktop-only.
- Add a `Scrub` slider to carousel controls.
- Use a 2x to 10x scrub multiplier range.
- Default the scrub multiplier to 4x.
- Apply the scrub multiplier to held physical ArrowLeft/ArrowRight keyboard scrubbing.
- Keep drag scrubbing as direct pointer movement, not speed-based movement.
- Preserve playback speed, Images, Hide UI, Space pause/resume, Escape close, Shuffle, Refresh, and bidirectional tape behavior.

## Validation

- Focused component coverage for the `Scrub` slider and 4x default.
- Focused carousel test suite.
- Targeted lint for touched files.
- Production build, service restart, and route smoke checks.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify held ArrowLeft/ArrowRight scrubbing returns to the previous fixed multiplier.

## Result

Implemented for the desktop fullscreen Gallery Carousel. Held ArrowLeft/ArrowRight scrubbing now uses a dedicated `Scrub` slider with a 2x-10x range and a 4x default.
