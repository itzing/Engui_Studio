---
id: ENGUI-231.4
title: >-
  Studio Photo Session phase 6.4 - add skip and restore shot actions with
  completion rules
status: Inbox
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-230.5
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-231
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement skip and restore actions for shot slots and wire them into run completion logic. Skipped shots should not block run completion and should be reversible without hard deletion or structural mutation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Shots can be marked skipped and later restored from within the run UI.
- [ ] #2 Skipped shots are excluded from the requirements for Completed run status.
- [ ] #3 Restore returns a skipped shot to normal run logic without losing its slot identity or history.
<!-- AC:END -->
