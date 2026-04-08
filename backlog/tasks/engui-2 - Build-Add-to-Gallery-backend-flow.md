---
id: ENGUI-2
title: Build Add to Gallery backend flow
status: Planned
assignee: []
created_date: '2026-04-08 21:01'
labels:
  - gallery
  - backend
  - api
dependencies: []
documentation:
  - /var/lib/openclaw/.openclaw/workspace/docs/engui-gallery-api-contract.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement explicit save from job output into gallery with idempotent dedupe and background enrichment enqueue.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 POST from-job-output resolves exact output by jobId + outputId
- [ ] #2 Deduplication uses workspaceId + contentHash
- [ ] #3 Repeated save of same file returns already-in-gallery behavior without duplicate asset creation
<!-- AC:END -->
