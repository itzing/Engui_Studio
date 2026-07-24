# ENGUI-451 - Add Gallery Carousel only favorites filter

Status: Done
Created: 2026-07-24T16:24:43Z
Finished: 2026-07-24T16:33:00Z

## Goal

Add an `Only favorites` filter to Gallery Carousel so the playback feed can include only favorited Gallery assets.

## Scope

- Desktop `GalleryVideoCarousel` controls.
- Phone `/m/carousel` settings and start handoff.
- Shared carousel settings persistence.
- Gallery Carousel API fetches for videos and images.

## Acceptance Criteria

- [x] Desktop Gallery Carousel has an `Only favorites` checkbox.
- [x] Phone `/m/carousel` has an `Only favorites` checkbox.
- [x] The setting persists per workspace/device with existing carousel settings.
- [x] When enabled, both video and image asset fetches pass `favoritesOnly=true`.
- [x] The carousel feed contains only favorited videos/images when enabled.
- [x] Focused tests cover persistence, UI handoff, and fetch query behavior.

## Validation

- Focused desktop Gallery Carousel tests: pass.
- Focused mobile Gallery Carousel tests: pass.
- Targeted ESLint on touched files: pass.
- `git diff --check`: pass.
- `npx prisma validate`: pass.
- `npm run build`: pass.
- Restarted `engui-studio.service`: active on port 3010.
- Smoke checks for `/`, `/m/carousel`, `/m/gallery`, `/api/jobs`, and `/api/gallery/assets?workspaceId=default&type=video&favoritesOnly=true`: 200.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify carousel feeds ignore favorite state again.
