---
id: engui-344
title: Preserve WAN22 draft for job output img2vid
status: Done
assignee: Rocky
created: 2026-07-08
---

## Summary

Make `To img2vid` from image job outputs behave like gallery image reuse: send only the selected image into the WAN22 image input and preserve the current Create Video draft prompt and parameters.

## Acceptance Criteria

- [x] Desktop job output `To img2vid` sends the selected image as the WAN22 source image without replacing the current video prompt/options.
- [x] Desktop center preview `To img2vid` for job outputs uses the same image-only WAN22 behavior.
- [x] Gallery image reuse remains unchanged.
- [x] Focused tests and production build pass.

## Notes

- Scope is the job reuse API used by desktop Jobs and desktop center preview for non-gallery job outputs.
- Rollback: revert the implementation commit, rebuild, and restart `engui-studio.service`.
