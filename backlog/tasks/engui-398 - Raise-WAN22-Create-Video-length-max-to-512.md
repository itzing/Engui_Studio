---
id: ENGUI-398
title: Raise WAN22 Create Video length max to 512
status: Done
assignee: []
created_date: '2026-07-13 19:19'
updated_date: '2026-07-13 19:22'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
WAN22 Create Video currently limits the `length` parameter to 161 frames. Raise the shared desktop/mobile Create Video maximum to 512 frames.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 WAN22 Create Video `length` parameter has max 512.
- [x] #2 Existing WAN22 defaults remain unchanged.
- [x] #3 Focused tests cover the new max without launching live RunPod jobs.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Raised the shared WAN22 Create Video `length` parameter max from 161 to 512 in the model config. Kept the existing default at 80 frames and added focused coverage for the new maximum.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
WAN22 Create Video now allows up to 512 frames for the `length` parameter on shared desktop/mobile create surfaces.
<!-- SECTION:FINAL_SUMMARY:END -->
