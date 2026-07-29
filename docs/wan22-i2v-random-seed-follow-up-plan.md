# WAN22 I2V Random Seed Follow-Up Plan

## Goal

Make Wan 2.2 I2V random seed behavior match Image Create: the job uses a fresh seed, and the form reflects the actual seed returned by the generation API.

## Scope

- Shared desktop/mobile `VideoGenerationForm` for `wan22`.
- Optimistic queued video job metadata.
- Draft hydration safety around reference image changes.

## Implementation

1. Update `VideoGenerationForm` after successful submit to read `data.seed` and write it into `parameterValues.seed` when the value is finite.
2. Include the returned seed, `randomizeSeed`, and prompt variant metadata in the optimistic `addJob` payload.
3. Track user edits during asynchronous draft restoration and skip stale draft application when the user has already interacted with the form.
4. Add focused component tests for post-submit seed update and `Random seed` persistence after image upload.

## Rollback

Revert the Engui commit, run `npm run build`, and restart `engui-studio.service`.
