---
id: ENGUI-229
title: >-
  Studio Photo Session v1 phase 4 — pose assignment and shot preparation
  workflows
status: Inbox
assignee: []
created_date: '2026-05-06 18:21'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-228
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the pre-generation shot preparation workflows inside runs: lazy per-shot pose assignment, bulk assemble-all, manual pose selection, and reshuffle with revision creation. This phase should make runs operational as shot plans before any job execution happens.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Users can pick one pose, pick all poses, manually choose a pose, and reshuffle an assigned shot from within a run.
- [ ] #2 Automatic pose assignment uses unique random selection per run and leaves slots unassigned with a visible reason when a category is exhausted.
- [ ] #3 Manual pose picking is limited to the shot category but may intentionally reuse a pose already used elsewhere in the run.
- [ ] #4 Assigning or reshuffling a pose creates or advances shot revisions while preserving the stable shot slot identity.
<!-- AC:END -->
