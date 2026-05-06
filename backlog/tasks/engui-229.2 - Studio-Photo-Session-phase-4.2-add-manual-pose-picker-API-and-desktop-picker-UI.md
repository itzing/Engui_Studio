---
id: ENGUI-229.2
title: >-
  Studio Photo Session phase 4.2 - add manual pose picker API and desktop picker
  UI
status: Inbox
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-228.5
  - ENGUI-226.2
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-229
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add manual pose picking for a single shot, including the backend picker contract and the desktop selection UI. Manual picking must remain category-limited but may intentionally reuse a pose already used elsewhere in the run.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Users can open a pose picker for one shot and browse poses limited to that shot's category.
- [ ] #2 Manual selection may intentionally choose a pose already used elsewhere in the same run.
- [ ] #3 Choosing a manual pose creates or advances a shot revision cleanly.
<!-- AC:END -->
