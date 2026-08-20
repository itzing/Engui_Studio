# engui-519 - Clear TikTok video ready state when slots are unloaded

## Goal

Fix black TikTok slots when repeatedly swiping several items down and back up.

## Reproduction

Start from the first TikTok item, swipe down three times, swipe up three times, then repeat. Slots can return black because their stable TikTok instance id keeps stale video-ready/preload state after the actual video node was cleaned up.

## Scope

- Clear TikTok video readiness/preload/play/progress state whenever a video node is unloaded or moves outside the real-video +/-1 window.
- Keep poster layer visible until the remounted video node fires `loadeddata`/`canplay` again.
- Add focused regression coverage for the repeated 3-down/3-up swipe cycle.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and smoke `/m/carousel`.
