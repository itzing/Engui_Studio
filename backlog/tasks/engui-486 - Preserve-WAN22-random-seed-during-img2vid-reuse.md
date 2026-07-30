---
id: engui-486
title: Preserve WAN22 random seed during img2vid reuse
status: Done
labels: [wan22, video, desktop, mobile, reuse]
---

## Goal

Keep the Wan 2.2 Create Video `Random seed` setting intact when an image is sent into img2vid/Create Video.

## Acceptance Criteria

- [x] Sending a new image into the existing Wan 2.2 video draft preserves `randomizeSeed`.
- [x] The restored Create Video form keeps the `Random seed` checkbox checked when it was checked before reuse.
- [x] Focused tests cover the img2vid reuse draft path.

## Plan

See `docs/wan22-i2v-random-seed-img2vid-reuse-fix.md`.

## Result

Added `randomizeSeed` to the video draft schema and preserved it when img2vid reuse updates an existing Wan 2.2 video draft with a new source image.
