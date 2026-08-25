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
- Videos are muted, autoplayed, looped, and shown poster-first. The video loads over the poster with no loader.
- Photos use an image interval setting. The slider range is 5 to 10 seconds.
- Auto-advance starts the next queue item on half of the second loop of the last played video. Consecutive photos advance by the image interval setting.
- Pause stops queue processing only. Already mounted videos keep playing.
- Manual previous/next places the previous/next queue item into the last active slot. If that item has a different orientation, Flow switches layout immediately and starts it in the first slot of the new layout.

## Layout

- Portrait layout uses three overlapping slots:
  - Center is centered and appears behind the side slots.
  - Left starts from the left edge and overlaps the center.
  - Right starts from the right edge and overlaps the center.
  - Media fit matches the existing carousel.
- Landscape layout uses four slots without overlap, arranged from the center.
  - Keep media as visible as practical by width.
  - Vertical crop is allowed so the screen stays filled.

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
      imageIntervalSeconds: number
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
