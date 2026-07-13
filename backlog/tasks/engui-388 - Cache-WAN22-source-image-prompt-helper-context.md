# engui-388 - Cache WAN22 source image prompt helper context

## Status

Done

## Context

WAN2.2 video Prompt Helper now analyzes the selected source image before rewriting the prompt. The extracted factual context should be reused for repeated Prompt Helper calls against the same image and invalidated when the source image changes.

## Scope

- Cache the Vision Prompt Helper factual context for the current `wan22` source image.
- Reuse cached context for subsequent Prompt Helper calls while the same image remains selected.
- Invalidate the cache when the image file is replaced or removed.
- Add focused component test coverage.
- Validate with focused tests, production build, commit, push, and service restart.

## Rollback

Revert the implementation commit, run `npm run build`, and restart `engui-studio.service`.

## Result

- The selected `wan22` source image factual context is cached in the video form after the first Vision Prompt Helper extraction.
- Repeated Prompt Helper runs reuse cached context while the same image file remains selected.
- The cache is invalidated automatically when `imageFile` changes or is cleared.
- Added focused coverage that two prompt-helper runs with the same image make one vision request and two text-helper requests.
