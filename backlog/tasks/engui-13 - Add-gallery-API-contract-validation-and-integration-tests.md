---
id: ENGUI-13
title: Add gallery API contract validation and integration tests
status: Planned
assignee: []
created_date: '2026-04-08 21:06'
labels:
  - gallery
  - backend
  - api
  - infra
dependencies: []
documentation:
  - /var/lib/openclaw/.openclaw/workspace/docs/engui-gallery-api-contract.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add integration coverage for job outputs normalization, add-to-gallery idempotency, gallery reads, trash lifecycle, and reuse prefill actions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Tests cover duplicate add behavior and workspace-scoped contentHash semantics
- [ ] #2 Tests cover list/detail payload shape and gallery state transitions
- [ ] #3 Tests cover reuse action payload compatibility for supported asset types
<!-- AC:END -->
