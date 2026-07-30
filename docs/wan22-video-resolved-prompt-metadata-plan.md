# WAN22 Video Resolved Prompt Metadata Plan

## Goal

Expose enough Wan 2.2 prompt metadata to debug wildcard resolution for image-to-video jobs.

## Scope

- Job details on desktop and mobile.
- Gallery asset details on desktop and mobile.
- Gallery asset API response shape for video assets.
- Shared prompt metadata helpers.

## Implementation

1. Extend prompt metadata helpers to read source image original/resolved prompt versions from `sourceImageGenerationSnapshot`.
2. Add explicit prompt view modes for video jobs/assets: `Video`, `Resolved video`, `Source image`, and `Resolved source`.
3. Return `sourceImageResolvedPrompt` from gallery asset APIs.
4. Add focused API/helper tests for resolved source prompt extraction and gallery response fields.

## Rollback

Revert the Engui commit, run `npm run build`, and restart `engui-studio.service`.
