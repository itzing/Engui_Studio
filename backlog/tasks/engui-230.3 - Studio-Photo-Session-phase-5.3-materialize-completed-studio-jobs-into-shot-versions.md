---
id: ENGUI-230.3
title: >-
  Studio Photo Session phase 5.3 - materialize completed studio jobs into shot
  versions
status: Superseded
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-230.1
  - ENGUI-226.1
  - ENGUI-226.3
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-230
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a Studio Session job completes successfully, materialize its output into a shot version stored in the run/session domain with gallery-like metadata fields. The run should become version-first after completion rather than remaining job-centric.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Successful studio-session jobs create shot-version records under the correct run, shot, and revision.
- [ ] #2 Shot versions store gallery-like asset metadata and generation snapshot data in the session-owned domain.
- [ ] #3 Completed runs and shots primarily read from versions after materialization rather than from active job rows.
<!-- AC:END -->

## Superseded note

Superseded by Studio portfolio v1 rewrite (`ENGUI-238` through `ENGUI-259`). Template-first Studio tickets are no longer the product direction.
