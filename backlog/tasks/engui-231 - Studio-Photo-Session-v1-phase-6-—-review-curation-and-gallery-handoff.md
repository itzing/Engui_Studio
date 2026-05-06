---
id: ENGUI-231
title: 'Studio Photo Session v1 phase 6 — review, curation, and gallery handoff'
status: Inbox
assignee: []
created_date: '2026-05-06 18:21'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-230
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Turn runs into curation workspaces by adding version browsing, revision history viewing, selected-version control, hide/reject behavior, skip/restore shot actions, and explicit Add to Gallery. This phase should complete the core user-facing run workflow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Shot cards support quick browsing of versions and selecting the current final version for that shot.
- [ ] #2 Shot detail viewing is centered on the current revision, while older revisions remain available as separate history.
- [ ] #3 Users can hide/reject versions, skip/restore shots, and those states feed correct run completion logic.
- [ ] #4 A run result can be explicitly added to Gallery without automatically mixing session results into the Gallery domain.
<!-- AC:END -->
