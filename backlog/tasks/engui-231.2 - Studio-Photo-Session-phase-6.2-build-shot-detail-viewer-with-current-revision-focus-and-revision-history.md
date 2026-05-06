---
id: ENGUI-231.2
title: >-
  Studio Photo Session phase 6.2 - build shot detail viewer with current
  revision focus and revision history
status: Inbox
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-230.5
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-231
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the detailed shot viewer that distinguishes between versions of the current revision and older revisions created by reshuffles or manual pose replacement. The viewer should default to the current revision and keep older revisions available as history.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Opening a shot detail view focuses first on the current revision.
- [ ] #2 Users can browse versions within the current revision and inspect older revisions separately as history.
- [ ] #3 The viewer clearly distinguishes version changes from revision changes in the UI.
<!-- AC:END -->
