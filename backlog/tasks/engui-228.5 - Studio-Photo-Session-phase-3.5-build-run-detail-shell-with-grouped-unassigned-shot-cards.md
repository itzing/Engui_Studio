---
id: ENGUI-228.5
title: >-
  Studio Photo Session phase 3.5 - build run detail shell with grouped
  unassigned shot cards
status: Superseded
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-228.2
  - ENGUI-228.3
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-228
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the initial run detail workspace with grouped shot sections and unassigned shot cards. This shell becomes the base for later pose assignment, execution, and review behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Run detail view groups shots by category with stable slot ordering.
- [ ] #2 Unassigned shot cards clearly show slot label, category, and action placeholders for Pick pose and Run shot.
- [ ] #3 The run detail shell is usable before any generation, version browsing, or review features are added.
<!-- AC:END -->

## Superseded note

Superseded by Studio portfolio v1 rewrite (`ENGUI-238` through `ENGUI-259`). Template-first Studio tickets are no longer the product direction.
