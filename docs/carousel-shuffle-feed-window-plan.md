# Carousel Shuffle Feed Window Plan

## Goal

Move Carousel shuffle mode from client-side full-gallery loading to `/api/carousel/feed-window` so desktop and mobile startup receive a ready window instead of fetching every gallery asset into the browser.

## Scope

- Add `source=shuffle` to `/api/carousel/feed-window`.
- Keep `source=galleryOrder` behavior unchanged for Gallery View.
- Use a deterministic seed for shuffle order so before/after cursor windows preserve the same feed.
- Return lightweight carousel feed items rather than full Gallery assets.
- Update the shared `GalleryVideoCarousel` non-Gallery View path.

## Plan

1. Parse and return a shuffle seed in the feed-window API.
2. Build a server-side feed with existing media, favorite, orientation, bucket, trash, and search filters.
3. Apply the existing shuffle/image-slot helper with a seeded random function.
4. Slice the shuffled feed with the same `previous/current/next` and cursor response shape used by Gallery View.
5. Store the active seed in the carousel component and generate a new one for explicit Shuffle actions.
6. Add focused API and component tests.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and verify non-Gallery View Carousel uses the previous `/api/gallery/assets` loading path.
