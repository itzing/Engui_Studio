---
id: ENGUI-3
title: Normalize job details outputs for gallery integration
status: Done
assignee: []
created_date: '2026-04-08 21:01'
updated_date: '2026-04-09 09:06'
labels:
  - gallery
  - jobs
  - backend
  - api
dependencies: []
documentation:
  - >-
    /var/lib/openclaw/.openclaw/workspace/docs/engui-gallery-implementation-plan.md
  - /var/lib/openclaw/.openclaw/workspace/docs/engui-gallery-api-contract.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make Job Details expose a stable outputs[] contract for gallery save and multi-output handling.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Job details API returns normalized outputs[] items with stable outputId
- [x] #2 Each output exposes alreadyInGallery and galleryAssetId when available
- [x] #3 Frontend can call Add to Gallery using jobId + outputId without raw path logic
<!-- AC:END -->
