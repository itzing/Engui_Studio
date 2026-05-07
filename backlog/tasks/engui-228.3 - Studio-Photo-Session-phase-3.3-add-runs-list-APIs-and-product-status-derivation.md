---
id: ENGUI-228.3
title: >-
  Studio Photo Session phase 3.3 - add runs list APIs and product-status
  derivation
status: Superseded
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-228.1
  - ENGUI-226.4
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-228
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the run-list API surface and product-status derivation needed to browse Draft, Ready, In progress, Needs review, and Completed runs. Status logic should reflect shot/review state rather than raw job state alone.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Runs can be listed per workspace through dedicated Studio Session APIs.
- [ ] #2 Product-level run statuses are derived consistently through shared status helpers.
- [ ] #3 Status derivation does not depend only on active jobs and remains meaningful for pre-run and review-heavy states.
<!-- AC:END -->

## Superseded note

Superseded by Studio portfolio v1 rewrite (`ENGUI-238` through `ENGUI-259`). Template-first Studio tickets are no longer the product direction.
