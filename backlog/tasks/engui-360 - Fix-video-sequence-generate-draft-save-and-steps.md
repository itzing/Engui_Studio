---
id: ENGUI-360
title: Fix video sequence generate draft save and steps
status: Done
assignee:
  - Rocky
created_date: '2026-07-09 11:24'
updated_date: '2026-07-09 11:30'
labels: []
dependencies: []
priority: high
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `Generate selected` preserves current unsaved Segment inspector prompt, LoRAs, seed, random seed toggle, source, and options before queueing.
- [x] #2 `Generate from here` preserves the current selected segment draft before starting the chain.
- [x] #3 Add an explicit desktop Segment inspector `Steps` setting with default `4`.
- [x] #4 Generated WAN22 payloads include `steps=4` by default unless the segment overrides it.
- [x] #5 Keep changes desktop-only, avoid live RunPod jobs, pass focused tests/build, and restart Engui service.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The reported failure happened because generation actions used the persisted segment row, while the Segment inspector draft could still be unsaved. Rollback: revert the implementation commit, rebuild, and restart `engui-studio.service`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed the desktop Video Sequence Builder generation actions so they persist the current selected segment draft before queueing `Generate selected` or `Generate from here`. Added a visible `Steps` control to the Segment inspector with default `4`, merged it into `generationOptionsJson`, changed WAN22 and new video sequence/segment defaults to `steps: 4`, and kept the existing generation payload shape.
<!-- SECTION:FINAL_SUMMARY:END -->
