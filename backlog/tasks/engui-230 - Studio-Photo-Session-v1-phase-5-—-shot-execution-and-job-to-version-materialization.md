---
id: ENGUI-230
title: >-
  Studio Photo Session v1 phase 5 — shot execution and job-to-version
  materialization
status: Superseded
assignee: []
created_date: '2026-05-06 18:21'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-229
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Connect Studio Session shots to the existing generation pipeline so individual shots or full runs can launch ordinary jobs, then materialize completed outputs back into shot versions under the correct revision. The run should pivot from transient job state to persistent version state as soon as a result is available.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Users can run one shot or launch all runnable shots in a run, and unassigned Run shot auto-picks a pose before execution.
- [ ] #2 Session-originated jobs carry enough context to map completion back to workspace, run, shot, and revision.
- [ ] #3 Each successful completed job materializes into a shot version with gallery-like asset metadata stored in the run/session domain.
- [ ] #4 The first successful version auto-becomes selected, while later versions do not replace the selected version automatically.
<!-- AC:END -->

## Superseded note

Superseded by Studio portfolio v1 rewrite (`ENGUI-238` through `ENGUI-259`). Template-first Studio tickets are no longer the product direction.
