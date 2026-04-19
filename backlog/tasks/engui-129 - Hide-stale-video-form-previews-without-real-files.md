---
id: ENGUI-129
title: Hide stale video form previews without real files
status: Done
assignee: []
created_date: '2026-04-19 11:42'
labels:
  - wan22
  - video
  - ux
  - validation
  - drafts
references:
  - /home/engui/Engui_Studio/src/components/forms/VideoGenerationForm.tsx
priority: high
updated_date: '2026-04-19 11:44'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The video generation form can currently restore `imagePreviewUrl` or `videoPreviewUrl` from draft state even when there is no live `File` object behind that preview anymore. This makes the UI look like a valid source input still exists, while submit paths such as WAN 2.2 correctly fail because no uploadable file reaches `/api/generate`.

Do not try to reconstruct missing files in this ticket. Instead, if no real file is present after restore/reopen, do not show the preview at all. The form should only render media previews when the corresponding `File` object still exists in memory.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The video form does not show an image preview unless `imageFile` exists
- [x] #2 The video form does not show a video preview unless `videoFile` exists
- [x] #3 Draft restore no longer leaves a misleading preview visible when no real file survived
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated `src/components/forms/VideoGenerationForm.tsx` so restored video-form previews are only shown when there is still a live `File` object in memory. The draft restore path now clears both image/video previews by default and only rehydrates the preview URL when a `data:` payload can also be turned back into a `File`. The rendered preview blocks were also tightened to require both `imageFile` + `imagePreviewUrl` and `videoFile` + `videoPreviewUrl`.

This prevents stale preview-only UI from misleading WAN 2.2 users into thinking a valid source image is still attached after reopen/reload.
<!-- SECTION:FINAL_SUMMARY:END -->
