---
id: ENGUI-10
title: Add gallery database schema and migration
status: Planned
assignee: []
created_date: '2026-04-08 21:06'
labels:
  - gallery
  - backend
  - infra
dependencies: []
documentation:
  - >-
    /var/lib/openclaw/.openclaw/workspace/docs/engui-gallery-implementation-plan.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Define database schema and migration for gallery assets, media refs, editable metadata, and immutable generation snapshot.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Schema covers asset identity, workspace scope, hashes, flags, tags, media refs, and generation snapshot
- [ ] #2 Migration is reversible or safely forward-only with documented behavior
- [ ] #3 Schema supports duplicate detection by workspaceId plus contentHash
<!-- AC:END -->
