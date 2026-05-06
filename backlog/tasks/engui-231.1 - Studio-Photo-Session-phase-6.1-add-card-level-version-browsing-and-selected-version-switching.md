---
id: ENGUI-231.1
title: >-
  Studio Photo Session phase 6.1 - add card-level version browsing and
  selected-version switching
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
Add quick review controls directly on shot cards so users can browse versions and switch the selected current version without immediately opening a deep detail view. This is the first curation-focused UX layer on top of versioned results.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Shot cards let users browse through versions associated with the current revision or currently visible result context.
- [ ] #2 Users can set the shown version as the selected version for that shot from the card surface.
- [ ] #3 Card-level browsing works without collapsing the stable shot grouping and ordering in the run UI.
<!-- AC:END -->
