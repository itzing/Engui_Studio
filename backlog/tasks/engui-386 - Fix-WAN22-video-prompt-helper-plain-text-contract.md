# engui-386 - Fix WAN22 video prompt helper plain text contract

## Status

Done

## Context

The Prompt Helper API now returns the improved prompt as `text/plain`. Image create already consumes that contract through `requestImagePromptImprovement`, but the WAN2.2 video form still expects a JSON response with `success` and `improvedPrompt`, causing prompt assistance to fail for video.

## Scope

- Update WAN2.2 Create Video Prompt Helper client code to consume the plain text response contract.
- Preserve the `wan22-video` helper profile in the request payload.
- Add focused test coverage for the video Prompt Helper plain text response path.
- Validate with focused tests, production build, commit, push, and service restart.

## Rollback

Revert the implementation commit, run `npm run build`, and restart `engui-studio.service`.

## Result

- WAN2.2 Create Video Prompt Helper now uses the shared plain text Prompt Helper client.
- The video request still sends `helperProfile: "wan22-video"`.
- Added focused coverage for applying a `text/plain` Prompt Helper response in the video form.
