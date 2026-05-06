---
id: ENGUI-231.5
title: >-
  Studio Photo Session phase 6.5 - add explicit Add to Gallery from studio shot
  versions
status: Inbox
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-230.3
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-231
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the explicit handoff action that copies a studio-session result into the ordinary Gallery domain without automatically syncing session results. This keeps session storage separate while preserving the best images through intentional import.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Users can explicitly send a shot version from Studio Sessions into Gallery.
- [ ] #2 Session results do not automatically appear in Gallery until the user invokes Add to Gallery.
- [ ] #3 Gallery handoff reuses existing gallery asset creation patterns while preserving separate session-result storage.
<!-- AC:END -->
