---
id: ENGUI-229.4
title: >-
  Studio Photo Session phase 4.4 - add shot reshuffle with revision lineage and
  reuse exclusion
status: Inbox
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-229.1
  - ENGUI-226.5
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-229
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement per-shot reshuffle so a slot can receive a new automatic pose without losing its slot identity. Reshuffle must create a new revision and exclude already auto-used poses from the run's history.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Assigned shots can reshuffle to a new automatically picked pose while preserving stable slot identity.
- [ ] #2 Each reshuffle creates a new shot revision that inherits non-pose state from the prior revision.
- [ ] #3 Reshuffle excludes already auto-used poses from the same run when automatic selection is used.
<!-- AC:END -->
