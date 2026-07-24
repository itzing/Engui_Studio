# Video Presets Exclude Source Image Snapshot Plan

## Goal

Prevent WAN/img2vid video presets from storing source image generation metadata. A video preset should capture reusable video prompt/settings only, while `sourceImageGenerationSnapshot` should remain tied to the currently selected source image.

## Scope

- Shared desktop/mobile `VideoGenerationForm`.
- Client video preset helper.
- Server `/api/create/video-presets` normalization.
- Focused tests for helper and API behavior.

## Plan

1. Add a sanitizer for video preset parameter values that removes `sourceImageGenerationSnapshot`.
2. Use the sanitizer when creating or overwriting video presets.
3. Preserve the current `sourceImageGenerationSnapshot` when applying a preset so preset changes do not detach the selected source image metadata.
4. Add a server-side guard that strips `sourceImageGenerationSnapshot` from incoming and listed video preset payloads.
5. Run focused tests, build, restart the service, smoke test, commit, and push.

## Rollback

Revert the implementation commit, run `npm run build`, and restart `engui-studio.service`.
