# Carousel feed window API

## Goal

Carousel feed startup should use a dedicated server endpoint that accepts carousel parameters and returns a ready playback window. `Gallery View` should not load the full gallery before showing the first slots.

## Scope

- Add a general carousel feed window endpoint.
- Move `Gallery View` startup to server-side media, orientation, favorite, and gallery-context filtering.
- Let the shared carousel player extend the window before and after the current feed while scrubbing.
- Keep shuffle mode on the existing full-feed path for this iteration.

## Plan

1. Add `/api/carousel/feed-window` with `source=galleryOrder`, media filters, orientation filters, `favoritesOnly`, gallery context filters, `anchorAssetId`, `direction`, and side limits.
2. Return `previous`, `current`, `next`, counts, and before/after cursors.
3. Load `Gallery View` from the endpoint and start paused around `current`.
4. When the player reaches a loaded edge, request `direction=before` or `direction=after` and merge unique feed items without remounting existing slots.
5. Add focused API and component regressions.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and verify `Gallery View` returns to the previous full-scan loading path.
