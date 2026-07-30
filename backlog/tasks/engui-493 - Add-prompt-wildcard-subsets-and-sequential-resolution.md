# engui-493 - Add prompt wildcard subsets and sequential resolution

## Status

Done

## Context

Prompt wildcard picker currently supports either random selection from all variants or one fixed variant serialized by value. Users need to choose a subset of possible variants and optionally resolve them sequentially across new generations.

## Acceptance Criteria

- [x] Prompt wildcard picker supports selecting multiple variants.
- [x] Prompt text serializes selected subsets as `{key:0,2,5}` and keeps `{key}` for all-random.
- [x] Picker shows `Select all` instead of `Random variant` when not all variants are selected.
- [x] Picker exposes `Random`/`Sequential` mode and a valid `Start index` input from `0` to `selected.length - 1`.
- [x] Random mode resolves from the selected subset using existing seeded prompt variant behavior.
- [x] Sequential mode resolves from the selected subset cursor, advances after submit, and wraps to `0`.
- [x] Image and video create flows preserve wildcard selection metadata in drafts/presets where applicable.
- [x] Generation metadata records the selected wildcard config and actual replacement.
- [x] Focused tests cover picker serialization and server expansion.

## Result

Implemented prompt wildcard subset tokens and sequential resolver state. The picker now supports multi-select, mode selection, and start index. `/api/generate` expands indexed subset tokens and advances sequential cursors in returned metadata. Image create, mobile image prompt editing, video create, video drafts, and video presets preserve the selection metadata.

## Rollback

Revert the implementation commit, run `npm run build`, then restart `engui-studio.service`.
