---
id: ENGUI-227.2
title: Studio Photo Session phase 2.2 - add template CRUD and clone API routes
status: Inbox
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-226.1
  - ENGUI-226.3
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-227
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the Studio Session template API layer for create, read, update, save, and clone operations. The route contract must separate autosaved editor draft state from canonical saved template state used for run creation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 API routes exist for loading templates, saving template drafts, explicitly saving canonical template state, and cloning templates.
- [ ] #2 Template APIs are workspace-scoped and validate required fields consistently.
- [ ] #3 Clone behavior creates a new editable template instead of mutating the original template record.
<!-- AC:END -->
