# Gallery video source prompt toggle plan

## Goal

When a Gallery asset is a WAN video created from an image, the details view should let the user inspect both the video prompt and the source image prompt.

## Scope

- Desktop Gallery asset details dialog.
- Mobile and tablet Gallery details route.
- Gallery asset API responses that already normalize prompt metadata.
- No generation behavior changes.

## Plan

1. Extract the source image prompt from `generationSnapshot.sourceImageGenerationSnapshot`.
2. Include that prompt in single-asset and list Gallery API payloads as `sourceImagePrompt`.
3. Add a compact prompt switcher in details views for video assets when `sourceImagePrompt` is available.
4. Keep existing Original/Resolved prompt switching for non-video assets and videos without source prompt.

## Expected behavior

- Video details can switch between `Video` and `Source image` prompt text.
- If a video also has a resolved video prompt, the switcher shows `Video`, `Resolved`, and `Source image`.
- Image and audio details keep the current prompt behavior.
- UI text remains English on every platform.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and verify Gallery details return to the previous prompt display.
