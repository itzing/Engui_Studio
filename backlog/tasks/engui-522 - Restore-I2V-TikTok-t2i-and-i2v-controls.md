# engui-522 - Restore I2V TikTok t2i and i2v controls

Labels: [gallery, mobile, tiktok, controls]

## Summary

Fix mobile TikTok action controls for WAN22 I2V videos so they show the intended text-to-image and image-to-video reuse actions.

## Scope

- Mobile TikTok carousel feed payload.
- TikTok action control compatibility rules.
- Gallery reuse action compatibility for WAN22 video assets.

## Acceptance Criteria

- [x] Carousel feed-window responses include video `modelId` so TikTok controls can identify WAN22 I2V/T2V videos.
- [x] WAN22 I2V videos show To txt2img and To img2vid in TikTok controls.
- [x] WAN22 I2V videos do not show To T2V.
- [x] WAN22 T2V videos continue to show To txt2img and To T2V, without To img2vid.

## Result

- Added `modelId` to carousel feed display assets.
- Restored WAN22 I2V gallery reuse compatibility to To txt2img and To img2vid only.
- Kept To T2V limited to WAN22 T2V video assets.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify mobile TikTok controls return to the previous action set.
