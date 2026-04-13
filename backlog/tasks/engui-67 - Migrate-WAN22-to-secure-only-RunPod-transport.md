---
id: ENGUI-67
title: Migrate WAN22 to secure-only RunPod transport
status: In Progress
assignee: []
created_date: '2026-04-13 16:22'
updated_date: '2026-04-13 16:22'
labels:
  - engui
  - wan22
  - secure-transport
  - runpod
dependencies:
  - WAN22-01
priority: high
---

## Description

Switch Engui WAN22 submission/finalization flow to the secure-only RunPod contract used by secure image and upscale jobs.

## Scope

- upload WAN22 input image as encrypted media input
- store WAN22 secure input under a dedicated prefix instead of `upscale-inputs`
- send `media_inputs` and `transport_request` with deterministic filenames
- require secure result finalization with no plaintext fallback
- keep cleanup behavior aligned with the existing secure transport pipeline

## Acceptance Criteria

- WAN22 submit path does not send plaintext `image_path`
- WAN22 uses secure input files under `/runpod-volume/wan22-inputs/`
- WAN22 secure output uses Engui-controlled filename under `/runpod-volume/secure-jobs/`
- completed WAN22 jobs finalize through `transport_result`
- no plaintext fallback remains in the WAN22 Engui path
