---
id: ENGUI-229.3
title: >-
  Studio Photo Session phase 4.3 - add assemble-all bulk pose assignment for
  runs
status: Inbox
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-229.1
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-229
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the bulk Assemble all action that fills existing run slots with automatically picked poses without reordering the UI. This must use the same uniqueness rules as single-shot automatic assignment.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Runs expose a bulk action that assigns poses across eligible shot slots.
- [ ] #2 Bulk assignment fills existing stable slots instead of reordering or regenerating them.
- [ ] #3 Bulk assignment uses the same run-level uniqueness rules as single-shot auto-picking.
<!-- AC:END -->
