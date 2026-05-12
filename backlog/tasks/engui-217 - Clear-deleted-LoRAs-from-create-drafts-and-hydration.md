---
id: ENGUI-217
title: Clear deleted LoRAs from create drafts and hydration
status: Done
assignee: []
created_date: '2026-04-30 23:45'
labels:
  - lora
  - create
  - drafts
  - z-image
  - wan22
dependencies: []
documentation: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prevent deleted LoRAs from surviving in persisted create draft state. When a LoRA is deleted from the manager, remove all references to it from image/video create drafts. On image/video create startup and draft hydration, validate persisted LoRA slots against the currently available LoRA list and automatically clear any stale slot values and reset their weights before submit can serialize them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Deleting a LoRA removes matching references from persisted image and video create drafts
- [x] #2 Image create hydration/startup clears stale LoRA slots that no longer resolve to available LoRAs
- [x] #3 Video create hydration/startup clears stale LoRA slots that no longer resolve to available LoRAs
- [x] #4 Submit no longer sends deleted LoRA filenames after UI startup/hydration
- [x] #5 Build passes and deployed app is restarted and verified
<!-- AC:END -->

## Implementation Notes

- `removeDeletedLoraFromCreateDrafts` is called after LoRA manager delete success and clears matching image/video persisted draft references.
- Image and video create hydration now sanitize LoRA parameter values against the successful `/api/lora` catalog using the latest state, so stale/deleted LoRA values are cleared before submit while valid reused values are preserved during loading.
- Validation: targeted lint passed with existing warnings; production build passed; `engui-studio.service` restarted and `/api/settings` returned HTTP OK. Code changes landed in `205cb04`; this ticket status update documents the covered scope.
