---
id: ENGUI-6
title: Implement server-side gallery reuse actions
status: Done
assignee: []
created_date: '2026-04-08 21:01'
labels:
  - gallery
  - backend
  - api
  - frontend
dependencies: []
documentation:
  - /var/lib/openclaw/.openclaw/workspace/docs/engui-gallery-api-contract.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add server-side prefill actions for Open in txt2img, img2img, and img2vid so clients do not need custom field mapping.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 txt2img prefill endpoint returns compatible prompt/settings payload
- [x] #2 img2img and img2vid use the gallery asset as source image
- [x] #3 Clients only receive compatible actions per asset type and origin
<!-- AC:END -->
