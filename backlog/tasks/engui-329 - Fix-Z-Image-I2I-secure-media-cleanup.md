---
id: ENGUI-329
title: Fix Z-Image I2I secure media cleanup
status: In Progress
assignee: []
created_date: '2026-06-01 10:18'
labels:
  - z-image
  - secure-transport
  - cleanup
dependencies:
  - ENGUI-320
  - ENGUI-18
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Z-Image image-to-image submit currently creates an unnecessary plaintext S3 upload before the secure media input pipeline runs, and completed secure jobs are not reliably deleting encrypted `media_inputs` artifacts after finalization.
<!-- SECTION:DESCRIPTION:END -->

## Scope

- Z-Image I2I generation submit path.
- Secure media input cleanup in the RunPod supervisor.
- Regression coverage for cleanup of secure media inputs and encrypted transport result objects.

## Acceptance Criteria

- [x] Z-Image I2I submit does not create a plaintext root S3 upload for the init image.
- [x] Z-Image I2I still sends the init image through encrypted `media_inputs`.
- [x] Secure cleanup deletes every recorded `media_inputs` storage path for terminal jobs.
- [x] Secure cleanup deletes the encrypted transport result after local materialization.
- [x] Cleanup warnings include enough detail to identify which key failed.
- [x] Regression tests cover the cleanup delete calls for secure input and result artifacts.

## Implementation Notes

<!-- SECTION:IMPLEMENTATION-NOTES:BEGIN -->
Fixed by deferring file uploads for secure RunPod models to encrypted `media_inputs`, adding detailed secure cleanup state with attempted/deleted/failed keys, storing secure result storage paths for cleanup retry, and adding a supervisor sweep that retries pending/warning cleanup for terminal jobs.
<!-- SECTION:IMPLEMENTATION-NOTES:END -->
