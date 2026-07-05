---
id: engui-340
title: Fix video LoRA picker pair display
status: Done
labels: [desktop, mobile, lora, video, bug]
---

## Problem

Wan 2.2 video LoRA selection is inconsistent after image/video filtering. Desktop shows only part of the available complete video LoRA pairs, while mobile can expose Low and High files as separate choices instead of one paired choice.

## Acceptance Criteria

- [x] Desktop Wan 2.2 LoRA picker shows every complete Low+High video LoRA pair.
- [x] Mobile Wan 2.2 LoRA picker shows complete Low+High video LoRAs as paired choices, not separate files.
- [x] Pair detection uses the same centralized Low/High rules as image/video filtering.
- [x] Incomplete Low-only or High-only files remain excluded from video pair choices.
- [x] Focused tests and production build pass.

## Notes

Scope is the shared LoRA pair picker/builder used by desktop and mobile video create flows. Image LoRA picker filtering should remain unchanged.

Implementation centralizes pair building in `src/lib/lora/modelFilters.ts`, including `HighNoise`/`LowNoise` naming and known LoRA extension handling, then reuses that builder from `LoRAPairSelector`.
