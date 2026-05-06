---
id: ENGUI-231.3
title: >-
  Studio Photo Session phase 6.3 - add hide and reject controls for shot
  versions
status: Inbox
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-231.1
  - ENGUI-231.2
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-231
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add soft hide/reject behavior for shot versions so poor results stop cluttering the main review surface without being hard-deleted. This should preserve lineage and keep later debugging or reconsideration possible.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Shot versions can be marked hidden or rejected without hard deletion.
- [ ] #2 Hidden or rejected versions remain in history while no longer dominating the primary review surface.
- [ ] #3 Hide/reject state updates are visible consistently in both card-level and detail-view review flows.
<!-- AC:END -->
