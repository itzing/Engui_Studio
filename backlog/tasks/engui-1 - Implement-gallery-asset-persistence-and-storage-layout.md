---
id: ENGUI-1
title: Implement gallery asset persistence and storage layout
status: Planned
assignee: []
created_date: '2026-04-08 21:01'
labels:
  - gallery
  - backend
  - api
  - infra
dependencies: []
documentation:
  - >-
    /var/lib/openclaw/.openclaw/workspace/docs/engui-gallery-implementation-plan.md
  - /var/lib/openclaw/.openclaw/workspace/docs/engui-gallery-api-contract.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add first-class gallery asset persistence, gallery-owned storage, immutable generation snapshot, and contentHash-based identity.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Gallery asset can exist without source job
- [ ] #2 Deleting source job later does not break gallery asset access
- [ ] #3 Persistence stores contentHash, media refs, tags, flags, and immutable generation snapshot
<!-- AC:END -->
