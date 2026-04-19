---
id: ENGUI-128
title: Reject WAN 2.2 submits without a real image file
status: Done
assignee: []
created_date: '2026-04-19 11:06'
labels:
  - wan22
  - video
  - validation
  - secure-transport
  - ux
dependencies: []
references:
  - /home/engui/Engui_Studio/src/app/api/generate/route.ts
  - /var/lib/openclaw/.openclaw/workspace/projects/engui-endpoints/wan22_Runpod_hub/handler.py
priority: high
updated_date: '2026-04-19 11:08'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
WAN 2.2 secure jobs require an encrypted `media_inputs` entry with role `source_image`. Today Engui can still submit a WAN 2.2 job even when no real image file reaches `/api/generate`, which lets the request travel to RunPod and fail there with `WAN22_SECURE_TRANSPORT_FAILED`.

Add a minimal early server-side guard in `/api/generate` so WAN 2.2 submissions without a real uploaded image file are rejected locally with a clear 400 error before the RunPod request is sent. Do not change endpoint behavior in this ticket.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `/api/generate` returns 400 for `modelId=wan22` when no usable image file is present in the request
- [x] #2 The request is rejected before any RunPod submission attempt
- [x] #3 Existing valid WAN 2.2 submits with a real image file continue to work unchanged
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a minimal server-side guard in `/src/app/api/generate/route.ts` for `modelId === 'wan22'`. Engui now rejects the request locally with HTTP 400 and code `WAN22_SOURCE_IMAGE_REQUIRED` when no real uploaded image file reaches the route, preventing empty secure WAN 2.2 submits from being forwarded to RunPod and failing there with `WAN22_SECURE_TRANSPORT_FAILED`.

Validated with a production build and service restart. Endpoint behavior itself was left unchanged.
<!-- SECTION:FINAL_SUMMARY:END -->
