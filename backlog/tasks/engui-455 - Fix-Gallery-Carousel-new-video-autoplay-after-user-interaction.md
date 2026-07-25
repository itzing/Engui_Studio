# ENGUI-455 - Fix Gallery Carousel new video autoplay after user interaction

Status: Done
Created: 2026-07-25

## Goal

Fix a Gallery Carousel regression where loaded videos start after a user tap, but videos that enter the carousel afterward remain paused with the native play overlay.

## Scope

- Gallery video carousel playback only.
- Preserve muted, inline, looping playback.
- Do not change gallery fetching, ordering, filters, or generation flows.

## Acceptance Criteria

- Current visible videos can be retried after the user interacts with the carousel.
- Newly mounted video slots also retry playback after prior user interaction.
- Playback retry does not spam `play()` calls every animation frame for videos that are already playing.
- Focused tests cover the regression.

## Result

Implemented on 2026-07-25.

- Gallery Carousel now records playback user interaction and retries mounted video playback after it.
- Newly mounted carousel video slots retry playback once the interaction unlock has happened.
- Video playback requests remain de-duplicated for already requested slots.
- Added focused regression coverage for a later-mounted video slot after autoplay was initially blocked.
