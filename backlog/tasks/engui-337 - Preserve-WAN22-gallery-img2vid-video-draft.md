---
id: engui-337
title: Preserve WAN22 video draft when opening gallery image as img2vid
status: done
created: 2026-07-05T19:03:00Z
labels: [video, gallery, wan22, desktop, mobile]
---

## Summary

When opening a gallery image in Create Video as WAN22 img2vid, only replace the source image. Keep the existing video prompt and generation parameters unchanged on both desktop and mobile.

## Acceptance Criteria

- Desktop Gallery Details `Open in img2vid` sends only the gallery image into the WAN22 video draft.
- Mobile Gallery Details `To img2vid` sends only the gallery image into the WAN22 video draft.
- Existing WAN22 video prompt remains unchanged.
- Existing WAN22 video parameter values remain unchanged, including width, height, seed, CFG, steps, length, negative prompt, and LoRA fields.
- Job reuse behavior remains unchanged.
- Tests cover the gallery img2vid draft-preservation behavior.

## Notes

- Gallery img2vid reuse payloads now mark the handoff as draft-preserving.
- The shared create reuse persistence keeps the existing WAN22 video prompt, advanced state, parameters, and video input while replacing only `imagePreviewUrl`.
- Validation completed: focused Vitest suite and production build.
- Rollback: revert the implementation commit, rebuild, and restart `engui-studio.service`.
