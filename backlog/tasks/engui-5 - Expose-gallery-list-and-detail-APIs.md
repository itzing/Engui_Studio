---
id: ENGUI-5
title: Expose gallery list and detail APIs
status: Planned
assignee: []
created_date: '2026-04-08 21:01'
labels:
  - gallery
  - backend
  - api
  - mobile
dependencies: []
documentation:
  - /var/lib/openclaw/.openclaw/workspace/docs/engui-gallery-api-contract.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add gallery list and detail endpoints with pagination, filters, and lightweight/full payload split for web and future mobile reuse.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 List endpoint supports pagination and default sort by addedToGalleryAt desc
- [ ] #2 Detail endpoint returns full generation snapshot and asset capabilities
- [ ] #3 Web can render gallery grid from list payload only
<!-- AC:END -->
