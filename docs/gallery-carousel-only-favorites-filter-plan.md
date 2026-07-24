# Gallery Carousel Only Favorites Filter Plan

## Context

Gallery asset API already supports `favoritesOnly=true`. Gallery Carousel currently fetches all non-trashed assets for each enabled media type and filters locally by orientation.

## Plan

1. Extend persisted carousel settings with an `onlyFavorites` boolean defaulting to `false`.
2. Add an `Only favorites` checkbox to desktop carousel controls.
3. Add the same setting to phone `/m/carousel` settings and pass it into the player.
4. Include `favoritesOnly=true` in carousel video/image API requests when enabled.
5. Reload/reset the carousel feed when the filter changes.

## Validation

- Focused settings/unit tests for persistence.
- Focused desktop carousel tests for fetch params and toggle behavior.
- Focused mobile carousel tests for settings restore and player handoff.
- Targeted ESLint on touched files.
- `git diff --check`.
- `npx prisma validate`.
- Production build and `engui-studio.service` restart.
- Smoke checks for Gallery Carousel routes and API.
