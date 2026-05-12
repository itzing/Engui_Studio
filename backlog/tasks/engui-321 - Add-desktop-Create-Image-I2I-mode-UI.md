---
id: ENGUI-321
title: Add desktop Create Image I2I mode UI
status: Done
assignee: []
created_date: '2026-05-12 19:32'
labels: []
dependencies:
  - ENGUI-319
  - ENGUI-320
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a first-class `I2I` mode to the desktop Create Image UI. Replace the current Control toggle with a short mode selector (`Text | Control | I2I`), keep Control and I2I image inputs visually separate, and add the I2I init image block, long-side control, denoise slider/presets, and Extract prompt action.
<!-- SECTION:DESCRIPTION:END -->

## Scope

- Desktop Create Image mode selector.
- I2I init image block.
- Paste, file picker, and URL intake UI.
- Long side field with default `1536`.
- Denoise slider, numeric value, and presets.
- Extract prompt button wiring.
- I2I validation errors.

## Acceptance Criteria

- Mode selector displays `Text | Control | I2I`.
- Control and I2I image blocks are not visually or semantically mixed.
- I2I init image supports Ctrl+V paste, file picker, and URL.
- Adding or replacing an I2I init image clears the positive prompt only.
- Negative prompt, LoRA, seed, and generation settings are preserved when replacing the init image.
- Long side defaults to `1536`; width/height are not manually exposed in I2I.
- Denoise defaults to `0.35`.
- Denoise presets are `0.25`, `0.35`, `0.50`, and `0.65`, with hover tooltips and no visible explanatory labels.
- Extract prompt is enabled only after a valid init image preview exists.
- Extract prompt replaces the positive prompt only and does not launch a job.
- Generate in I2I without an init image shows `Init image is required for I2I`.
- Generate in I2I without a prompt shows `Prompt is required for I2I`.

## Implementation Notes

<!-- SECTION:IMPLEMENTATION-NOTES:BEGIN -->
Implemented in the current Z-Image I2I change set. Verified with endpoint Python compile/workflow structural check, Engui targeted lint, production build, and Engui service restart.
<!-- SECTION:IMPLEMENTATION-NOTES:END -->
