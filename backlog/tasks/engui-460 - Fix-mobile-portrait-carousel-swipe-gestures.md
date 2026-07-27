# ENGUI-460 - Fix mobile portrait carousel swipe gestures

## Status

Done

## Description

Mobile portrait landscape-only carousel should scrub on vertical swipes and close on horizontal swipes. Keep existing landscape player behavior where vertical swipe closes.

## Scope

- `/m/carousel` mobile/iPad fullscreen overlay gesture wrapper.
- Focused mobile carousel tests.

## Acceptance Criteria

- [x] Portrait vertical carousel stays open for up/down touch movement so the shared player can scrub the tape.
- [x] Portrait vertical carousel closes with a left or right touch swipe.
- [x] Landscape horizontal carousel keeps the existing vertical swipe close behavior.

## Implementation Plan

1. Update mobile overlay close gesture direction based on active carousel movement axis.
2. Add focused mobile carousel tests for portrait vertical scrub preservation and horizontal close.
3. Run focused tests, targeted lint, build, restart service, and smoke routes.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and verify `/m/carousel`.

## Result

Implemented on 2026-07-27.

- Mobile portrait landscape-only Carousel now reserves vertical swipes for scrub gestures and closes with horizontal left/right swipes.
- Mobile landscape Carousel keeps the existing vertical swipe close behavior.
- Validation passed: focused mobile/shared carousel Vitest, targeted ESLint, `git diff --check`, Prisma validate, and production build.
