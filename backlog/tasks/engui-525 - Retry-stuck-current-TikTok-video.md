# engui-525 - Retry stuck current TikTok video

Labels: [gallery, mobile, tiktok, video, retry]

## Summary

Retry only the current TikTok video slot when network loading stalls and the loader stops making progress.

## Scope

- Mobile TikTok carousel current-slot video lifecycle.
- Current-slot retry state cleanup while swiping.
- Focused regression coverage for current-only retries.

## Acceptance Criteria

- [x] A stuck current TikTok video retries automatically after the loader makes no progress.
- [x] Neighbor video slots are not retried until they become the current slot.
- [x] Retry state is cleared when a slot leaves the active/retryable lifecycle.
- [x] After a bounded number of automatic retries, the current slot exposes a manual retry action.

## Result

- Added current-only TikTok video retry timers that reset when loader progress changes or the current slot changes.
- Retried the current video by remounting only that `<video>` element with the same source URL.
- Kept neighbor slots untouched; they retry only after becoming the centered current slot.
- Added a manual `Retry` action after the automatic retry limit.
- Added focused regression coverage for current-only retry behavior.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify TikTok loading returns to the previous non-retry behavior.
