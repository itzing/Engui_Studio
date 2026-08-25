# Desktop Flow Carousel Mode Plan

## Goal

Add a separate desktop-only Flow mode beside the existing Gallery Carousel. Flow uses the same gallery filters, but owns its queue ordering, layout rhythm, controls, and persisted settings.

## Confirmed Behavior

- Flow is a separate desktop mode, similar to how TikTok is a separate mobile mode.
- Flow uses the carousel filters, favorites filter, and gallery/search bucket filters.
- Flow excludes square and unknown-ratio assets from its queue.
- Flow supports two queue sources:
  - Order: current gallery/filter order.
  - Random: Flow-owned shuffle that reshuffles after a full queue pass.
- Flow queue blocks alternate:
  - `3 * portraitCycles` portrait items.
  - `4 * landscapeCycles` landscape items.
  - Repeat until the available assets are exhausted.
- If an orientation does not have enough items, use what exists. If it has none, skip that block.
- When the queue wraps, Order repeats the same queue and Random rebuilds a newly shuffled queue.
- Previous and next controls wrap around queue boundaries.

## Playback Rules

- Every item has a next slot according to the active orientation slot map.
- Portrait slots: left, center, right, then left again.
- Landscape slots: top-left, bottom-right, top-right, bottom-left, then top-left again.
- Videos are muted, autoplayed on Flow activation, and shown poster-first. The video loads over the poster with no loader.
- The Next slot setting controls queue activation speed for all Flow media. The slider range is 3 to 10 seconds.
- Auto-advance starts the next queue item on the configured Next slot timer, independent of video duration. When a visible Flow video ends, it restarts locally without advancing the queue.
- Pause stops queue processing only. Already mounted videos keep playing.
- Manual previous/next follows the slot map too: next advances to the next slot and previous moves to the previous slot. If that item has a different orientation, Flow switches layout immediately and starts it in the first slot of the new layout.

## Layout

- Portrait layout uses three equal-width slots across the screen:
  - Left, center, and right each take one third of the viewport width.
  - Slots do not overlap.
  - Portrait media is centered and contained inside each slot so the full height can play without covering neighboring slots.
- Landscape layout uses four slots without overlap, arranged from the center.
  - Keep media as visible as practical by width.
  - Vertical crop is allowed so the screen stays filled.
- Flow settings slide in and out from a right-edge hover target and can also be toggled from the top controls.

## Persistence

Persist settings in the existing workspace-scoped carousel settings payload. Store Flow-specific settings in a profile-ready structure:

```ts
flow: {
  activeProfileId: 'default',
  profiles: {
    default: {
      id: 'default',
      name: 'Default',
      orderMode: 'order' | 'random',
      portraitCycles: number,
      landscapeCycles: number,
      slotActivationSeconds: number
    }
  }
}
```

Profiles are not part of this implementation, but the data model should make adding them later straightforward.

## Validation

- Add focused helper tests for Flow queue construction, square/unknown filtering, block alternation, and random rebuild behavior.
- Add settings normalization tests for the profile-ready Flow settings payload.
- Add component coverage for Flow controls and persisted settings if practical.
- Run focused Vitest, targeted ESLint, `git diff --check`, Prisma validation, production build, service restart, and smoke checks.

## Rollback

Revert the implementation commit, run `npm run build`, and restart `engui-studio.service`.
