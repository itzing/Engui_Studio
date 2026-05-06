---
id: ENGUI-227.5
title: >-
  Studio Photo Session phase 2.5 - add generation controls and autosave versus
  explicit save model
status: Inbox
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-227.4
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-227
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the generation-settings block, short/long/square resolution policy controls, and the autosave-versus-explicit-save behavior required by the spec. Users should be able to work safely without losing progress while still having a clear saved template state.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The editor supports template-level generation settings and short-side/long-side/square-source resolution policy fields.
- [ ] #2 Editor changes autosave into draft state without silently promoting incomplete edits into canonical saved template state.
- [ ] #3 Explicit Save writes the canonical template state later used by Create Run.
<!-- AC:END -->
