# Mobile gallery favorites and carousel anchor fix

## Goal

Fix the reproduced mobile flow where the Gallery favorites filter resets after returning from Carousel, and where Carousel Gallery View starts at favorite index 0 when the selected Gallery anchor is a nearby non-favorite asset.

## Scope

- Persist mobile Gallery `favoritesOnly` per workspace.
- Preserve carousel nearest-anchor behavior when `favoritesOnly=true`.
- Keep desktop and shuffle carousel behavior unchanged.

## Plan

1. Store mobile Gallery favorites-only state under a workspace-scoped localStorage key and hydrate it with the existing Gallery preferences.
2. Keep `feed-window` source order aware of the requested `anchorAssetId` even when carousel favorites filtering is enabled.
3. Apply media, orientation, and favorites filters to the playable feed after the source position is known.
4. Add regression coverage for the mobile Gallery preference and the non-favorite-to-nearest-favorite anchor path.

## Rollback

Revert the implementation commit, run a production build, restart `engui-studio.service`, and smoke `/m/gallery`, `/m/carousel`, and `/api/carousel/feed-window`.
