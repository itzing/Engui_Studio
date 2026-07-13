# engui-387 - Add source image context to WAN22 video prompt helper

## Status

Done

## Context

WAN2.2 image-to-video Prompt Helper should look at the source image and produce a prompt that fits that image. WAN2.2 T2V must remain text-only because it has no source image input.

## Scope

- For `wan22` only, analyze the selected source image with the existing Vision Prompt Helper before running the text Prompt Helper.
- Add the extracted visual context to the text Prompt Helper instruction while preserving `helperProfile: "wan22-video"`.
- Keep `wan22-t2v` on the current text-only path.
- Add focused component test coverage.
- Validate with focused tests, production build, commit, push, and service restart.

## Rollback

Revert the implementation commit, run `npm run build`, and restart `engui-studio.service`.

## Result

- `wan22` Prompt Helper now analyzes the selected source image through Vision Prompt Helper before asking the text Prompt Helper to rewrite the video prompt.
- The visual context is appended to the helper instruction as source-image ground truth.
- `wan22-t2v` remains text-only.
- Added focused component coverage for the image-aware WAN2.2 Prompt Helper flow.
