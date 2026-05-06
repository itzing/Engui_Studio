---
id: ENGUI-226.2
title: >-
  Studio Photo Session phase 1.2 - add static pose-library dataset and
  normalization layer
status: Inbox
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies: []
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-226
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Check in the approved pose-library dataset for v1 and add a normalization layer that exposes stable categories, orientation values, framing values, and pose access helpers. Treat the library as a versioned internal dataset rather than a new manager surface.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The supplied studio-session pose library is committed into the repo as a versioned dataset.
- [ ] #2 Normalization helpers expose stable access to categories, orientation, framing, ids, names, and prompts.
- [ ] #3 Invalid or incomplete pose entries are caught or normalized consistently before downstream use.
<!-- AC:END -->
