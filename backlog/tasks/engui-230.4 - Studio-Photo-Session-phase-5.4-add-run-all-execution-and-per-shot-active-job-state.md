---
id: ENGUI-230.4
title: >-
  Studio Photo Session phase 5.4 - add run-all execution and per-shot active job
  state
status: Superseded
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-230.1
  - ENGUI-229.3
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-230
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the run-level action that launches all runnable shots and expose active execution state per shot while jobs are in flight. The run UI should stay usable and accurately show which slots are currently executing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Runs expose a Run all action that launches all currently runnable shots.
- [ ] #2 Each shot surfaces active execution state while its job is running.
- [ ] #3 Run-all execution respects existing assignment and auto-pick rules instead of bypassing them.
<!-- AC:END -->

## Superseded note

Superseded by Studio portfolio v1 rewrite (`ENGUI-238` through `ENGUI-259`). Template-first Studio tickets are no longer the product direction.
