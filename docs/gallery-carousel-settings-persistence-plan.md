# Gallery Carousel Settings Persistence Plan

## Goal

Remember Gallery Carousel parameters in the browser on the current device, per workspace.

## Approach

- Add a small localStorage helper in the shared carousel component for a workspace-scoped settings payload.
- Let desktop `GalleryVideoCarousel` hydrate from that payload before its initial asset load.
- Persist changes from desktop controls as the user changes media type toggles, orientation toggles, speed, and scrub speed.
- Use the same helper from mobile `/m/carousel` so the settings screen opens with saved values and writes updates before playback starts.

## Validation

- Add focused regression coverage for desktop persisted settings and mobile setting hydration.
- Run focused Vitest, targeted ESLint, `git diff --check`, Prisma validation, production build, service restart, and smoke checks.

## Rollback

Revert the implementation commit, run the production build, and restart `engui-studio.service`.
