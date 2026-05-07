---
id: ENGUI-229.5
title: >-
  Studio Photo Session phase 4.5 - render assigned shot cards with prompt
  preview and actions
status: Superseded
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-229.1
  - ENGUI-228.5
  - ENGUI-226.4
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-229
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Upgrade assigned shot cards so they show the chosen pose, derived orientation and framing, and a short prompt preview alongside Run shot and Reshuffle pose actions. This is the first real pre-execution review surface for an assigned slot.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Assigned shot cards show pose name, derived orientation, derived framing, and a short prompt preview.
- [ ] #2 Assigned shot cards expose Run shot and Reshuffle pose actions in-place.
- [ ] #3 Prompt previews use the shared prompt-assembly path instead of duplicated UI-only logic.
<!-- AC:END -->

## Superseded note

Superseded by Studio portfolio v1 rewrite (`ENGUI-238` through `ENGUI-259`). Template-first Studio tickets are no longer the product direction.
