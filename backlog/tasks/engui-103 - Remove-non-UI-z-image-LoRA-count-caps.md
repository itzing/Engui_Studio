---
id: ENGUI-103
title: Remove non-UI z-image LoRA count caps
status: Done
assignee: [openclaw]
created_date: '2026-05-02 18:52'
labels:
  - backend
  - z-image
  - lora
dependencies: []
priority: high
---

## Description

Remove server-side z-image LoRA count caps in Engui while leaving the current UI slot cap unchanged.

## Acceptance Criteria

- [x] `src/app/api/generate/route.ts` no longer hard-caps z-image LoRA collection at 4 slots
- [x] Engui backend forwards any submitted `lora`, `lora2`, ... entries it receives
- [x] Existing 4-slot UI remains unchanged
- [x] Validation/build passes
