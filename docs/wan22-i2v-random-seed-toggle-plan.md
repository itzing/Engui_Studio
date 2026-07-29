# WAN22 I2V Random Seed Toggle Plan

## Goal

Add a `Random seed` control to Wan 2.2 I2V Create so prompt variant tokens resolve differently between runs when desired.

## Scope

- Shared desktop/mobile `VideoGenerationForm` for `wan22`.
- Form submission metadata sent to `/api/generate`.
- Video create draft persistence.
- Video create preset snapshots.

## Implementation

1. Add a `randomizeSeed` boolean state to `VideoGenerationForm`.
2. Restore and save the value in the video workflow draft.
3. Include the value in video create preset snapshots and restore it when applying a preset.
4. Append `randomizeSeed` to generation `FormData`.
5. Add focused component coverage for submit payload and persistence.

## Rollback

Revert the Engui commit, run `npm run build`, and restart `engui-studio.service`.
