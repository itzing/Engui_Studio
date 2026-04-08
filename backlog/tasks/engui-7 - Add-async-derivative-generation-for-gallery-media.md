---
id: ENGUI-7
title: Add async derivative generation for gallery media
status: Planned
assignee: []
created_date: '2026-04-08 21:02'
labels:
  - gallery
  - backend
  - infra
dependencies: []
documentation:
  - >-
    /var/lib/openclaw/.openclaw/workspace/docs/engui-gallery-implementation-plan.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add background thumbnail and preview generation so gallery saves stay fast while UI media catches up asynchronously.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Asset creation succeeds even if derivative worker is down
- [ ] #2 Gallery exposes derivative readiness status
- [ ] #3 Worker can backfill derivatives later
<!-- AC:END -->
