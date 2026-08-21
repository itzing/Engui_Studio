# engui-520 - Add TikTok tap action controls

Labels: [gallery, mobile, tiktok, controls]

## Summary

Add tap-revealed action controls to mobile TikTok carousel mode.

## Scope

- Mobile TikTok carousel behavior in `GalleryVideoCarousel`.
- Existing gallery favorite, share, and reuse APIs.

## Acceptance Criteria

- [x] Tapping the TikTok viewer toggles action controls on and off.
- [x] Swiping to another TikTok video hides the action controls.
- [x] Controls include Favorite, Share, To txt2img, and the appropriate video reuse target: To img2vid for I2V videos, To T2V for T2V videos.
- [x] Non-TikTok carousel controls and tap-to-pause behavior remain unchanged.

## Result

- Added TikTok-only action controls that appear on tap and hide on second tap or swipe.
- Favorite updates the current gallery asset optimistically through the existing favorite API.
- Share uses the existing gallery Web Share helper.
- Reuse actions call the existing gallery reuse API, persist the returned create draft, and navigate to mobile Create.
- WAN22 T2V gallery videos now also expose `txt2img` reuse from their saved text prompt metadata, so the TikTok `To txt2img` action works for T2V videos.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify mobile TikTok returns to the previous no-overlay behavior.
