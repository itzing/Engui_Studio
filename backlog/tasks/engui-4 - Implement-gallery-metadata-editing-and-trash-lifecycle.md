---
id: ENGUI-4
title: Implement gallery metadata editing and trash lifecycle
status: Planned
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
Support MVP asset management for userTags, favorited, trashed, restore, and permanent delete.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 PATCH supports userTags, favorited, and trashed
- [ ] #2 Restore and empty trash flows work
- [ ] #3 Permanent delete removes original, derivatives, metadata, and enrichment artifacts
<!-- AC:END -->
