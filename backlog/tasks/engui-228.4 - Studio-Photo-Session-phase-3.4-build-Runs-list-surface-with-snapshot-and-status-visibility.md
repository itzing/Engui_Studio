---
id: ENGUI-228.4
title: >-
  Studio Photo Session phase 3.4 - build Runs list surface with snapshot and
  status visibility
status: Superseded
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-227.1
  - ENGUI-228.3
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-228
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the Runs list surface inside Studio Sessions so users can see created runs, their current product status, and quick entry into run detail views. The first iteration can stay pragmatic but must support real continuation of work.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The Runs tab lists existing Studio Session runs for the active workspace.
- [ ] #2 Each listed run surfaces enough status and identity information to reopen it later.
- [ ] #3 The Runs list integrates cleanly with the new Studio Sessions route shell.
<!-- AC:END -->

## Superseded note

Superseded by Studio portfolio v1 rewrite (`ENGUI-238` through `ENGUI-259`). Template-first Studio tickets are no longer the product direction.
