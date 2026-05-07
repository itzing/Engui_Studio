---
id: ENGUI-228
title: >-
  Studio Photo Session v1 phase 3 — run creation, snapshots, and stable shot
  slots
status: Superseded
assignee: []
created_date: '2026-05-06 18:21'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-227
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement immutable run creation from template snapshots and render the first real run workspace with stable shot slots grouped by category. This phase should make runs tangible without yet requiring pose assignment or generation execution.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Creating a run copies the saved template into an immutable run snapshot and does not auto-start generation.
- [ ] #2 Run creation produces stable shot slots from category counts with deterministic ordering and human-readable labels like Standing 1.
- [ ] #3 Runs appear in a dedicated Runs surface with product-level statuses such as Draft and Ready.
- [ ] #4 New run cards and run detail views correctly render unassigned shot slots grouped by category.
<!-- AC:END -->

## Superseded note

Superseded by Studio portfolio v1 rewrite (`ENGUI-238` through `ENGUI-259`). Template-first Studio tickets are no longer the product direction.
