# Gallery View paused warm seed

## Goal

Gallery View should feel like a paused gallery strip opened at the user's current gallery position: neighboring assets on both sides are already mounted, and no automatic scrolling starts until the user interacts.

## Problem

The shared carousel reset seeded only one previous and one next slot, then the animation frame filled only the current movement direction. That made Gallery View look loaded in one direction until the user scrubbed.

## Plan

1. Add reset options for initial pause state and neighbor seed depth.
2. Keep shuffle mode on the existing moving startup.
3. For Gallery View, seed multiple previous and next slots around the resolved start index.
4. Set Gallery View startup to paused so RAF does not immediately bias slot loading toward the forward direction.

## Validation

- Focused shared/mobile carousel Vitest.
- Targeted ESLint for changed files.
- `git diff --check`.
- `npx prisma validate`.
- Production build, service restart, and smoke checks.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and verify Gallery View returns to moving one-step startup.
