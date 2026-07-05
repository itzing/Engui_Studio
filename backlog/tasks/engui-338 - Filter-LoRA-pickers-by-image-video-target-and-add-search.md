---
id: engui-338
title: Filter LoRA pickers by image/video target and add search
status: Done
labels: [create, lora, desktop, mobile, ux]
---

## Problem

Create Image should not offer video LoRA files, and Wan 2.2 I2V should not offer image LoRA files. The custom z-image Add LoRA dialogs on desktop and mobile also need search with focus on open.

## Acceptance Criteria

- [x] Create Image LoRA pickers show only image LoRAs.
- [x] Wan 2.2 I2V LoRA pair pickers show only video LoRA pairs.
- [x] A LoRA pair with both Low and High components is treated as video.
- [x] All remaining single LoRAs are treated as image.
- [x] Desktop z-image Add LoRA dialog has search, focuses it on open, and filters immediately while typing.
- [x] Mobile z-image Add LoRA dialog has search, focuses it on open, and filters immediately while typing.
- [x] Existing selected LoRAs are sanitized against the filtered list for the current model.
- [x] Focused tests and production build pass.

## Notes

No Prisma migration for this pass. Classification is filename/path based until explicit LoRA target metadata is added.
