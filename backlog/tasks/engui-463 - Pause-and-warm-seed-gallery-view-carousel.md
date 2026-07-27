# ENGUI-463 - Pause and warm seed Gallery View carousel

## Status

Done

## Description

When Carousel starts in `Gallery View`, mount neighboring slots on both sides of the anchor immediately and keep the carousel movement paused until the user scrubs or resumes it.

## Scope

- Shared `GalleryVideoCarousel` reset/startup behavior.
- Desktop and mobile/iPad Carousel through the shared player.
- Focused regression tests.

## Acceptance Criteria

- [x] Gallery View starts with movement paused.
- [x] Gallery View immediately mounts multiple previous and next neighboring slots around the resolved anchor.
- [x] Shuffle mode keeps the existing moving startup behavior.

## Implementation Plan

1. Extend feed reset with startup options for paused movement and symmetric neighbor seeding.
2. Use those options only for Gallery View feed loads.
3. Add focused tests for paused Gallery View startup and both-side warm seeding.
4. Run build, restart, and smoke checks.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and verify the previous startup behavior returns.

## Result

Implemented on 2026-07-27.

- Gallery View feed reset now starts paused.
- Gallery View startup seeds up to three previous and three next neighboring slots around the resolved anchor.
- Shuffle mode keeps the existing moving startup and one-neighbor seed.
- Validation passed: focused shared/mobile carousel Vitest, targeted ESLint, `git diff --check`, Prisma validate, and production build.
