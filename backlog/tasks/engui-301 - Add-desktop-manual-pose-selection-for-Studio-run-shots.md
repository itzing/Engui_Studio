---
id: ENGUI-301
title: Add desktop manual pose selection for Studio run shots
status: Done
assignee: []
created_date: '2026-05-08 15:31'
labels:
  - studio-sessions
  - desktop
  - pose-library
  - runs
priority: high
dependencies: []
completed_date: '2026-05-08 15:45'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Allow desktop Studio run users to choose a concrete pose for a draft shot instead of relying only on auto-assignment. The picker should work from the run screen, update the shot's current revision, and avoid launching live generation jobs.
<!-- SECTION:DESCRIPTION:END -->

## Scope

- Desktop run screen only.
- Add API support for listing available shot poses and manually assigning one.
- Show current assigned pose in draft shots.
- Add a choose/change pose action for draft shots and generated result cards.
- Do not change mobile surfaces in this slice.
- Do not launch paid/live jobs during validation.

## Resolution

- Added desktop run-screen manual pose picker for draft shots.
- Added `GET/PATCH /api/studio/shots/[id]/poses` for available pose listing and manual assignment.
- Added current pose preview/name in draft shots and a `Change shot pose` action on result cards.
- Included pose primary preview URLs in Studio session pose snapshots.
- Validation: `npm run build` passed. Live generation jobs were not launched.
