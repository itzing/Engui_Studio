---
id: ENGUI-230.5
title: >-
  Studio Photo Session phase 5.5 - add first-version auto-selection and
  version-first shot rendering
status: Superseded
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-230.3
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-230
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the first-version auto-selection rule and switch shot rendering toward the version-first model once results exist. This phase establishes the baseline review behavior required before curation features land.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The first successful shot version auto-becomes the selected version for that shot.
- [ ] #2 Later successful versions do not automatically replace the selected version.
- [ ] #3 Once versions exist, shot UI renders the current selected/current version rather than treating jobs as the primary long-term object.
<!-- AC:END -->

## Superseded note

Superseded by Studio portfolio v1 rewrite (`ENGUI-238` through `ENGUI-259`). Template-first Studio tickets are no longer the product direction.
