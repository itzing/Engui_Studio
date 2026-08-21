# engui-521 - Add T2V reuse to I2V TikTok videos

Labels: [gallery, mobile, tiktok, controls]

## Summary

Show both video reuse actions for WAN22 I2V videos in mobile TikTok action controls.

## Scope

- Mobile TikTok carousel action controls.
- Gallery reuse compatibility for WAN22 I2V video assets.

## Acceptance Criteria

- [x] WAN22 I2V videos show Favorite, Share, To txt2img, To img2vid, and To T2V in TikTok controls.
- [x] WAN22 T2V videos continue to show To txt2img and To T2V, without To img2vid.
- [x] Existing favorite, share, and swipe-hide behavior remains unchanged.

## Result

- Added `txt2vid` as a compatible gallery reuse action for WAN22 I2V video assets.
- Updated TikTok action controls so WAN22 I2V videos expose both To img2vid and To T2V.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify mobile TikTok controls return to the previous action set.
