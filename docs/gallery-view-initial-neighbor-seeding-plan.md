# Gallery View initial neighbor seeding

## Goal

When Carousel opens in `Gallery View` from the middle of the gallery order, the current asset should be mounted together with immediate neighbors before and after it. The user should be able to scrub in either direction immediately without first forcing the carousel to discover one side.

## Scope

- Shared `GalleryVideoCarousel` feed reset and slot seeding.
- Desktop Carousel and `/m/carousel`, because both use the shared player.
- Preserve shuffle mode behavior and existing bidirectional scrubbing after playback starts.

## Validation

- Focused shared carousel tests for gallery-order startup from the middle.
- Focused mobile carousel tests to guard the mobile wrapper.
- Targeted ESLint on touched source/tests.
- Production build, service restart, and smoke checks.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and verify `Gallery View` returns to lazy one-sided startup.
