# ENGUI-461 - Seed Gallery View carousel neighbors on start

## Status

Done

## Description

When Carousel opens with `Gallery View` from the middle of the gallery order, mount the selected asset together with adjacent assets before and after it so scrubbing in both directions works immediately.

## Scope

- Shared `GalleryVideoCarousel` startup/reset behavior.
- Desktop and mobile/iPad Carousel through the shared player.
- Focused regression tests.

## Acceptance Criteria

- [x] Opening `Gallery View` from a middle asset immediately mounts the current asset and the next gallery asset.
- [x] Opening `Gallery View` from a middle asset immediately mounts the previous gallery asset.
- [x] Existing shuffle and bidirectional scrub behavior remain intact.

## Implementation Plan

1. Seed initial Carousel slots around the start index instead of starting from a single lazy direction.
2. Keep active slots ordered by feed index so existing previous/next spawn logic continues working.
3. Add/adjust focused regression tests, then run build, restart, and smoke checks.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and verify the old lazy startup behavior returns.

## Result

Implemented on 2026-07-27.

- Carousel feed reset now seeds the selected start slot plus immediate previous and next slots.
- The seeded slots keep feed-index order so existing lazy spawn and bidirectional scrubbing continue from both ends.
- Validation passed: focused shared/mobile carousel Vitest, targeted ESLint, `git diff --check`, Prisma validate, and production build.
