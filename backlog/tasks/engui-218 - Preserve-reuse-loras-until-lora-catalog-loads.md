---
id: ENGUI-218
title: Preserve reuse LoRAs until LoRA catalog loads
status: In Progress
assignee: []
created_date: '2026-05-01 07:48'
labels:
  - lora
  - reuse
  - gallery
  - drafts
  - z-image
dependencies: []
documentation: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix create reuse so LoRA values restored from gallery/job snapshots are not cleared before the real LoRA catalog finishes loading. Validate and clear stale LoRA slots only after a successful `/api/lora` response, not during initial hydration when the UI catalog is still empty.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Reuse from gallery preserves valid saved LoRAs until `/api/lora` finishes loading
- [ ] #2 Invalid saved LoRAs are still cleared after a successful catalog fetch
- [ ] #3 Image and video create flows no longer clear all LoRAs during initial hydration
- [ ] #4 Build passes and deployed app is restarted and verified
<!-- AC:END -->
