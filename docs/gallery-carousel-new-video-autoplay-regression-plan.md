# Gallery Carousel New Video Autoplay Regression Plan

## Context

Gallery Carousel videos can be blocked by browser autoplay policy before the user interacts with the page. Existing visible videos are retried when the user taps the carousel, but video slots that mount later can remain paused with the native play overlay.

## Plan

1. Track when the user has interacted with the carousel playback surface.
2. Retry playback for all mounted video elements after that interaction.
3. Retry newly mounted videos when active carousel slots change.
4. Keep retries scoped so already-playing videos are not repeatedly restarted.

## Validation

- Add a focused regression test for a later-spawned video after user interaction.
- Run the Gallery Carousel test file.
- Run targeted lint, `git diff --check`, Prisma validation, production build, service restart, and smoke checks.
