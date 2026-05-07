---
id: ENGUI-227.1
title: >-
  Studio Photo Session phase 2.1 - add desktop route shell with Templates and
  Runs tabs
status: Superseded
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-226.3
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-227
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the standalone desktop route shell for Studio Sessions and add the top-level Templates and Runs navigation surface. This should stay separate from the main Create page and align with the rest of the desktop app shell.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A dedicated Studio Sessions desktop route exists outside the main Create flow.
- [ ] #2 The new route shows top-level Templates and Runs tabs or equivalent navigation.
- [ ] #3 The shell integrates cleanly with the existing desktop layout without breaking other left-panel or page flows.
<!-- AC:END -->

## Superseded note

Superseded by Studio portfolio v1 rewrite (`ENGUI-238` through `ENGUI-259`). Template-first Studio tickets are no longer the product direction.
