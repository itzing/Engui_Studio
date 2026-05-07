---
id: ENGUI-229.1
title: >-
  Studio Photo Session phase 4.1 - add single-shot auto-pick and first revision
  creation
status: Superseded
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-228.5
  - ENGUI-226.5
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-229
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement automatic pose assignment for one shot slot and create the first shot revision when a pose is assigned. This is the lowest-level building block for lazy run preparation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A single unassigned shot can receive an automatically picked pose from its category rules.
- [ ] #2 Automatic picking respects the run's no-repeat rules for automatic pose usage.
- [ ] #3 The first successful assignment creates a shot revision rather than mutating the shot into an untyped state.
<!-- AC:END -->

## Superseded note

Superseded by Studio portfolio v1 rewrite (`ENGUI-238` through `ENGUI-259`). Template-first Studio tickets are no longer the product direction.
