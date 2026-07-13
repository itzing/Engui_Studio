---
id: ENGUI-394
title: Persist WAN22 source image Prompt Helper context per device
status: Done
assignee: []
created_date: '2026-07-13 11:55'
updated_date: '2026-07-13 12:00'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
WAN22 image-to-video Prompt Helper source-image context cache currently lives only in VideoGenerationForm memory and is lost when mobile navigation remounts the form. Make the visual context cache persistent on the device and shared by desktop and mobile Create Video flows.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Cache Vision Prompt Helper source-image text context in device-local storage, not the source image blob.
- [x] #2 Cache entries are keyed by source image fingerprint, model id, and extraction-version so restored File objects can reuse the same context.
- [x] #3 Mobile and desktop WAN22 Create Video Prompt Helper use the same persistent cache path and fall back to Vision Prompt Helper only on cache miss.
- [x] #4 Cache is bounded by age and entry count.
- [x] #5 Focused tests cover cache reuse after form remount without live RunPod jobs.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added a device-local WAN22 source image prompt cache in src/lib/create/videoSourcePromptCache.ts. The cache stores only Vision Prompt Helper text context in localStorage, keyed by model id, extraction version, and a byte fingerprint of the source image. VideoGenerationForm now checks the in-memory cache, then persistent cache, and calls Vision Prompt Helper only on cache miss. Entries are pruned to 50 recent items and expire after 30 days. Component coverage verifies cache reuse after form remount with the same restored image reference.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
WAN22 Create Video Prompt Helper now reuses source-image visual context across mobile/desktop form remounts on the same device, avoiding repeated Vision Prompt Helper extraction for the same reference image.
<!-- SECTION:FINAL_SUMMARY:END -->
