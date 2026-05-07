---
id: ENGUI-226.3
title: Studio Photo Session phase 1.3 - add domain types and payload contracts
status: Superseded
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-226.1
  - ENGUI-226.2
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-226
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the shared TypeScript types and serialization contracts for templates, saved template state, runs, shots, revisions, versions, and Studio Session API payloads. This should become the canonical contract layer used by both routes and UI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Canonical TypeScript interfaces exist for template, run, shot, revision, and version shapes used by the new module.
- [ ] #2 Request and response payload contracts are centralized instead of duplicated ad hoc in multiple files.
- [ ] #3 Saved-template state, editor draft state, and run snapshot state are explicitly distinguished in the domain layer.
<!-- AC:END -->

## Superseded note

Superseded by Studio portfolio v1 rewrite (`ENGUI-238` through `ENGUI-259`). Template-first Studio tickets are no longer the product direction.
