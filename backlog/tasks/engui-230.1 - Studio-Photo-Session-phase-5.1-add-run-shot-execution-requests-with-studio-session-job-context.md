---
id: ENGUI-230.1
title: >-
  Studio Photo Session phase 5.1 - add run-shot execution requests with
  studio-session job context
status: Superseded
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-228.5
  - ENGUI-229.5
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-230
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Connect Studio Session shots to the existing generation pipeline by launching ordinary jobs annotated with enough studio-session context to map results back into the run. This is the foundation for both single-shot and run-wide execution.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Run-shot execution launches ordinary generation jobs rather than a second bespoke executor.
- [ ] #2 Each launched job carries enough studio-session context to map completion back to workspace, run, shot, and revision.
- [ ] #3 The new execution path integrates cleanly with the current generation system and existing job persistence.
<!-- AC:END -->

## Superseded note

Superseded by Studio portfolio v1 rewrite (`ENGUI-238` through `ENGUI-259`). Template-first Studio tickets are no longer the product direction.
