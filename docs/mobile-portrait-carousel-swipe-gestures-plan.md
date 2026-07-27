# Mobile portrait carousel swipe gestures

## Goal

In mobile portrait landscape-only carousel playback, vertical touch movement should scrub the carousel tape. Closing should use a horizontal left or right swipe so it does not compete with vertical scrubbing.

## Scope

- Mobile `/m/carousel` fullscreen overlay gesture handling.
- Keep the existing landscape-device player close gesture unchanged: vertical swipe closes the horizontal carousel.
- Shared `GalleryVideoCarousel` already supports vertical-axis pointer scrubbing, so the change should avoid intercepting that gesture in the mobile wrapper.

## Validation

- Focused mobile carousel tests for portrait vertical scrub preservation and horizontal close.
- Existing carousel component tests for vertical scrubbing.
- Targeted ESLint on touched files.
- Production build, service restart, and smoke checks for `/m/carousel`.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and verify the old mobile close gesture behavior returns.
