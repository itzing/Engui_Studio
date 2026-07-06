# ENGUI-341 - Restore WAN22 video gallery metadata to img2vid

---
status: Done
priority: Medium
labels: [gallery, video, wan22, desktop, mobile]
created: 2026-07-06
---

## Problem

Gallery video assets saved from WAN22 jobs keep generation metadata, but Gallery Details only exposes `img2vid` reuse for image assets. Users need a video gallery asset to reopen Create Video WAN22 with the saved prompt and generation parameters, similar to how image gallery assets can reopen Create Image through `txt2img`.

## Acceptance Criteria

- Desktop Gallery Details exposes a `To img2vid` action for compatible WAN22 video assets.
- Mobile Gallery Details exposes the same action for compatible WAN22 video assets.
- The reuse payload restores WAN22 prompt and compatible generation parameters from the gallery asset metadata.
- The video-to-img2vid flow does not use the image-gallery preserve-current-draft behavior; it overwrites the WAN22 draft with saved metadata.
- When the original source image is unavailable, the flow uses an available gallery video thumbnail/first-frame derivative as the source image fallback so Create Video has a usable image input.
- Existing image gallery `txt2img`, `img2img`, and image-to-`img2vid` behavior remains unchanged.
- Add focused tests for the gallery reuse payload behavior.

## Notes

- Gallery metadata is stored in `GalleryAsset.generationSnapshot` when a job output is added to the gallery.
- Secure WAN22 runs may not retain a public source image path in job options, so the video thumbnail fallback is expected.

## Result

- Implemented on 2026-07-06.
- Desktop and mobile Gallery Details now expose `To img2vid` for WAN22 video assets.
- Gallery reuse restores WAN22 prompt and generation options from saved metadata, using source job image input or thumbnail fallback for the source image.
- Focused gallery reuse and draft persistence tests passed.
