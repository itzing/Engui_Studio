---
id: ENGUI-228.2
title: >-
  Studio Photo Session phase 3.2 - generate stable shot slots and grouping
  metadata on run creation
status: Inbox
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-228.1
  - ENGUI-226.4
  - ENGUI-226.5
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-228
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Generate stable shot slots from the template category counts when a run is created, including deterministic per-category ordering and human-readable labels. Keep slots materialized even before pose assignment so runs are first-class working containers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Run creation materializes stable shot slots from category counts with deterministic grouping and ordering.
- [ ] #2 Each slot receives a user-facing label like Standing 1 or Portrait 2 that remains stable across the life of the run.
- [ ] #3 New runs may contain unassigned shots without forcing immediate pose selection or execution.
<!-- AC:END -->
