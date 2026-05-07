---
id: ENGUI-232
title: 'Studio Photo Session v1 phase 7 — hardening, QA, and cleanup'
status: Superseded
assignee: []
created_date: '2026-05-06 18:21'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-231
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Stabilize the Studio Photo Session module after the main workflow exists: consolidate shared logic, add regression coverage, run a focused manual QA matrix, and clean up edge cases before future feature expansion. This phase should make the foundation safe for subsequent tickets and enhancements.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Regression coverage exists for template snapshotting, pose uniqueness, resolution derivation, first-version auto-selection, skip/restore, and Add to Gallery behavior.
- [ ] #2 A manual QA pass validates template editing, run creation, pose assignment, shot execution, reshuffle, reshoot, review, hide/reject, skip/restore, and gallery handoff.
- [ ] #3 Shared studio-session logic is consolidated and duplicate status/prompt assembly behavior is removed where practical.
- [ ] #4 The module is stable enough to continue with follow-up tickets without rethinking the base architecture.
<!-- AC:END -->

## Superseded note

Superseded by Studio portfolio v1 rewrite (`ENGUI-238` through `ENGUI-259`). Template-first Studio tickets are no longer the product direction.
