---
id: ENGUI-359
title: Add video sequence LoRA picker
status: Done
assignee:
  - Rocky
created_date: '2026-07-09 11:10'
updated_date: '2026-07-09 11:17'
labels: []
dependencies: []
priority: high
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Replace the desktop `/video-sequences` Segment inspector `LoRA JSON` textarea with a normal LoRA picker card.
- [x] #2 Match the Create Image pattern: selected LoRAs are shown, empty state is clear, and `Add LoRA` opens a searchable picker.
- [x] #3 For WAN/video LoRAs, add complete High/Low pairs into the next free slot and keep the generated `loraConfigJson` payload compatible with existing generation.
- [x] #4 Allow clearing selected LoRA pairs and editing weights without manually editing JSON.
- [x] #5 Keep changes desktop-only, avoid live RunPod jobs, pass focused tests/build, and restart Engui service.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope is the desktop `/video-sequences` Segment inspector generation controls. Rollback: revert the implementation commit, rebuild, and restart `engui-studio.service`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the desktop Video Sequence Builder Segment inspector `LoRA JSON` textarea with a normal LoRA picker card. The picker shows selected LoRA pairs, an empty state, a `0/8` style count, searchable `Add LoRA` modal, clear controls, and High/Low weight inputs while preserving the existing `lora_high_N`, `lora_low_N`, and weight keys in `loraConfigJson`.
<!-- SECTION:FINAL_SUMMARY:END -->
