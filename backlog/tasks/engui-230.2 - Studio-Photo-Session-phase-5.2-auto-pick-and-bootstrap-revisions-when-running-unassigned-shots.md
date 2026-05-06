---
id: ENGUI-230.2
title: >-
  Studio Photo Session phase 5.2 - auto-pick and bootstrap revisions when
  running unassigned shots
status: Inbox
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-230.1
  - ENGUI-229.1
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-230
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the required shortcut where pressing Run shot on an unassigned slot first auto-picks a pose, creates a revision, and then launches the job. This keeps empty slots runnable without forcing a separate preparation step.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Pressing Run shot on an unassigned slot automatically picks a pose before launching the job.
- [ ] #2 The auto-pick flow creates the needed revision state before execution starts.
- [ ] #3 This shortcut follows the same automatic uniqueness rules as explicit auto-pick actions.
<!-- AC:END -->
