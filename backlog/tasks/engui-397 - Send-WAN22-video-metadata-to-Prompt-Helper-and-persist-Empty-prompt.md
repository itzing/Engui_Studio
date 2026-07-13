---
id: ENGUI-397
title: Send WAN22 video metadata to Prompt Helper and persist Empty prompt
status: Done
assignee: []
created_date: '2026-07-13 13:09'
updated_date: '2026-07-13 13:15'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
WAN22 Create Video Prompt Helper should receive the current target video dimensions and frame count as hidden request context so it can shape prompt motion and framing to the actual output. The Empty prompt checkbox should also persist across desktop/mobile form remounts and tab switches.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Shared desktop/mobile WAN22 video Prompt Helper requests include target width, height, frame count, and derived duration when available.
- [x] #2 Prompt Helper API validates and forwards video metadata to the local provider without changing default image helper behavior.
- [x] #3 WAN22 provider prompt uses video metadata as hidden context for composition and motion pacing.
- [x] #4 Empty prompt checkbox state persists across form remounts/tab switches on the same device.
- [x] #5 Focused tests cover metadata payload, provider prompt context, and persisted checkbox behavior without live RunPod jobs.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Extended the shared video Prompt Helper request path with optional frame count, duration, and FPS metadata. WAN22 Create Video now sends current width, height, `length` frame count, derived duration, and FPS context to the `wan22-video` helper. The Prompt Helper API validates positive numeric metadata and forwards it to the provider. The WAN22 provider includes this as hidden pacing/composition context, while default image helper behavior remains unchanged. The Empty prompt checkbox is persisted in device-local storage so it survives desktop/mobile form remounts and tab switches.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
WAN22 Create Video Prompt Helper now receives target size and video length context, and its Empty prompt checkbox persists on the same device.
<!-- SECTION:FINAL_SUMMARY:END -->
