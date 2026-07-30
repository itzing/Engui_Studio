# ENGUI-489 - Restore resolved video prompt details tab

Status: done

## Goal

Show the `Resolved video` prompt tab in Job Details and Gallery Details when video metadata stores the resolved prompt in `resolvedVideoPrompt`.

## Scope

- Desktop Job Details
- Desktop Gallery Details
- Mobile Job Details
- Mobile Gallery Details
- Gallery asset APIs that normalize video prompt metadata

## Notes

- New Wan 2.2 video metadata stores `videoPrompt` and `resolvedVideoPrompt` explicitly.
- Existing prompt normalization must treat those explicit fields as the video original/resolved prompt pair.
- Keep source image prompt tabs unchanged.

## Rollback

Revert the Engui commit, run `npm run build`, and restart `engui-studio.service`.

## Result

Implemented in Engui Studio. Prompt normalization now reads explicit `videoPrompt` and `resolvedVideoPrompt`, so Job Details and Gallery Details can show the `Resolved video` tab when video metadata has that field. Prompt tab controls in desktop/mobile details now wrap instead of clipping when all four video prompt modes are available.
