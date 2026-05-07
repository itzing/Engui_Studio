---
id: ENGUI-226.5
title: >-
  Studio Photo Session phase 1.5 - add unique-random picking and run-level
  pose-history helpers
status: Superseded
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-226.2
  - ENGUI-226.3
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-226
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the picking helpers that enforce v1 uniqueness rules for automatic pose assignment and reshuffle while still allowing manual duplicate selection later. The helper layer should also expose exhausted-pool signals for UX and run integrity.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Automatic pick helpers select unique random poses within category according to the run's automatic-pick history.
- [ ] #2 Reshuffle helpers exclude already auto-used poses from the same run and report exhaustion cleanly.
- [ ] #3 The helper layer keeps manual-selection exceptions possible without weakening automatic uniqueness rules.
<!-- AC:END -->

## Superseded note

Superseded by Studio portfolio v1 rewrite (`ENGUI-238` through `ENGUI-259`). Template-first Studio tickets are no longer the product direction.
