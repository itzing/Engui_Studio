# WAN22 I2V Random Seed img2vid Reuse Fix

## Goal

Preserve the Wan 2.2 `Random seed` checkbox when users send an image into Create Video/img2vid. The new image should replace the reference frame without resetting the existing video generation seed policy.

## Scope

- Create reuse draft persistence for `type: video` and `action: img2vid`.
- Shared desktop/mobile `VideoGenerationForm` draft hydration.

## Implementation

1. Add `randomizeSeed` to the video draft type because `VideoGenerationForm` already persists and restores it.
2. When `persistCreateReuseDraft` preserves video draft fields, carry forward the existing `randomizeSeed` value.
3. Add a focused regression test for gallery/job img2vid reuse that starts with `randomizeSeed: true` and verifies it survives.

## Rollback

Revert the Engui commit, run `npm run build`, and restart `engui-studio.service`.
