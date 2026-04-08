---
id: ENGUI-12
title: Design gallery storage path and file-copy strategy
status: Planned
assignee: []
created_date: '2026-04-08 21:06'
labels:
  - gallery
  - backend
  - infra
dependencies: []
documentation:
  - /var/lib/openclaw/.openclaw/workspace/docs/engui-gallery-api-contract.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Define gallery-owned storage layout, exact file copy semantics, and duplicate-safe write behavior for saved assets.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Gallery uses owned storage instead of source job files
- [ ] #2 Storage path strategy is deterministic and documented
- [ ] #3 Write flow handles duplicate saves safely without orphan files
<!-- AC:END -->
