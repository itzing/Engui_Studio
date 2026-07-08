---
id: engui-345
title: Carry source image metadata through WAN22 video reuse
status: Done
assignee: Rocky
created: 2026-07-08
---

## Summary

When an image is sent to WAN22 img2vid, preserve the original image generation metadata on the resulting video. Add video `To txt2img` reuse for gallery and job videos, restoring Create Image from that source image metadata.

## Acceptance Criteria

- [x] Image-to-WAN22 reuse stores the source image generation metadata on the video job options.
- [x] Saving the resulting video to Gallery carries that source image metadata in `generationSnapshot`.
- [x] WAN22 videos in Gallery expose `To txt2img` and restore Create Image from the source image metadata.
- [x] Video job outputs expose/support `To txt2img` and restore Create Image from the source image metadata.
- [x] Focused tests and production build pass.

## Notes

- Metadata is stored in existing JSON fields; no database migration is required.
- Rollback: revert the implementation commit, rebuild, and restart `engui-studio.service`.
