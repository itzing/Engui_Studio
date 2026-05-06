---
id: ENGUI-228.1
title: >-
  Studio Photo Session phase 3.1 - add run creation service with immutable
  template snapshots
status: Inbox
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-227.2
  - ENGUI-227.5
  - ENGUI-227.6
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-228
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement run creation from canonical saved templates by snapshotting the approved template state into an immutable run configuration. This service is the boundary where template editing stops and run execution begins.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Create Run reads canonical saved template state rather than raw editor draft state.
- [ ] #2 Run creation stores an immutable snapshot of the template configuration and pose-library version context required by downstream work.
- [ ] #3 Template edits after run creation do not mutate existing runs.
<!-- AC:END -->
