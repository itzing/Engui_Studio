---
id: ENGUI-174
title: Auto-save successful upscale results into gallery as upscale entries
status: Inbox
assignee: []
created_date: '2026-04-23 09:05'
labels:
  - gallery
  - backend
  - api
dependencies:
  - ENGUI-175
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an upscale or video-upscale job finishes successfully, automatically create a gallery entry for the resulting media and mark it with bucket=upscale. This should happen in the successful completion path after the final result has been materialized and persisted. Duplicate content must still produce a separate gallery entry when the new result is an upscale output, because the product explicitly wants distinct entries even for identical bytes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Successful upscale jobs automatically create a gallery entry for their final output
- [ ] #2 Auto-created upscale gallery entries persist bucket=upscale
- [ ] #3 Auto-save occurs for both image upscale and video-upscale flows where applicable
- [ ] #4 Auto-save does not collapse into an existing asset only because contentHash matches
<!-- AC:END -->
