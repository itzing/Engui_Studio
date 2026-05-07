---
id: ENGUI-227.6
title: >-
  Studio Photo Session phase 2.6 - build compact category slider panel and
  template validation
status: Superseded
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-227.5
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-227
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the compact scrollable category-count control panel with one slider per category and the required validation around category counts in saved templates. This is the core shot-quantity planning UI for v1.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The template editor shows all supported categories in a compact scrollable container.
- [ ] #2 Each category uses a 0..20 slider with default value 5 and 0 meaning disabled.
- [ ] #3 Template save validation preserves category counts in an extensible rule structure rather than rigid fixed fields.
<!-- AC:END -->

## Superseded note

Superseded by Studio portfolio v1 rewrite (`ENGUI-238` through `ENGUI-259`). Template-first Studio tickets are no longer the product direction.
