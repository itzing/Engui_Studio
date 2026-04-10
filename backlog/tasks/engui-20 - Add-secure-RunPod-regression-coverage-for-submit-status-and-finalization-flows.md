---
id: ENGUI-20
title: Add secure RunPod regression coverage for submit, status, and finalization flows
status: Planned
assignee: []
created_date: '2026-04-10 17:59'
labels:
  - jobs
  - backend
  - api
  - infra
  - spec
dependencies:
  - ENGUI-17
  - ENGUI-18
  - ENGUI-19
documentation:
  - /var/lib/openclaw/.openclaw/workspace/docs/engui-secure-runpod-implementation-spec.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add regression coverage for the secure-only Engui RunPod path, including key validation, secure submit contract shape, read-only status behavior, finalization success, normalized failure handling, and transport cleanup warnings.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Tests cover submit rejection when the global key is missing or invalid
- [ ] #2 Tests cover request construction for `_secure`, `media_inputs[]`, and `transport_request`
- [ ] #3 Tests cover read-only status mapping from local Engui job state
- [ ] #4 Tests cover supervisor success and normalized failure cases
- [ ] #5 Tests cover cleanup warning persistence without changing completed or failed terminal status
<!-- AC:END -->
