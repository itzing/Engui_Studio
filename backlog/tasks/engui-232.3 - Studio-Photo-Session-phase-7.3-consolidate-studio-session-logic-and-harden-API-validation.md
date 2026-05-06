---
id: ENGUI-232.3
title: >-
  Studio Photo Session phase 7.3 - consolidate studio-session logic and harden
  API validation
status: Inbox
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-231.5
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-232
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Consolidate duplicated Studio Session logic, tighten API validation, and remove brittle state derivation before later feature work builds on top of the module. This phase is about maintainability and defensive correctness rather than visible product expansion.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Shared prompt assembly, status derivation, and shot-result mapping logic is consolidated where practical.
- [ ] #2 Studio Session APIs validate payloads consistently and fail clearly for malformed input.
- [ ] #3 The module avoids duplicated or drifting domain logic across API routes and desktop UI.
<!-- AC:END -->
