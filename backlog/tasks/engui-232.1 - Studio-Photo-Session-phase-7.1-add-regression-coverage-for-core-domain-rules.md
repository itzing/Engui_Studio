---
id: ENGUI-232.1
title: Studio Photo Session phase 7.1 - add regression coverage for core domain rules
status: Superseded
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-231.4
  - ENGUI-231.5
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-232
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add focused automated regression coverage for the Studio Session behaviors most likely to break future work: snapshotting, picking uniqueness, resolution derivation, first-version selection, skip/restore logic, and gallery handoff. The goal is confidence, not exhaustive end-to-end UI simulation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Automated tests cover template snapshotting and run immutability expectations.
- [ ] #2 Automated tests cover automatic pose uniqueness, reshuffle exclusion, and resolution derivation rules.
- [ ] #3 Automated tests cover first-version auto-selection plus skip/restore and Add to Gallery behavior.
<!-- AC:END -->

## Superseded note

Superseded by Studio portfolio v1 rewrite (`ENGUI-238` through `ENGUI-259`). Template-first Studio tickets are no longer the product direction.
