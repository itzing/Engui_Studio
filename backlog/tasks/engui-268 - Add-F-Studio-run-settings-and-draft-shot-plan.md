---
id: ENGUI-268
title: Add F-Studio run settings and draft shot plan
status: Done
assignee: []
created_date: '2026-05-07 21:55'
labels:
  - studio-sessions
  - f-studio
  - desktop
priority: high
---

## Description

F-Studio run pages currently allow creating and launching a run, but the run's settings are not visible/editable after creation and the user cannot see the draft shot plan before launch. Add a minimal v1 slice that surfaces run settings and draft shots similar to the previous v1 experience.

## Acceptance Criteria

- [x] Run detail page shows run settings: name, pose set/category, shot count, model/default generation settings where currently available.
- [x] Run detail page shows draft shots before generation, including label/category/status and assigned pose/prompt context if available.
- [x] Shot count/category settings are understandable before launch; if full editing is too large for this slice, clearly expose the current selected pose set and count and make the next edit path obvious.
- [x] Launch button remains available from the run page.
- [x] Build/test passes and Engui service is restarted after deployment.

## Implementation note

Added shot count to the New run dialog, surfaced run settings on the run detail page, and added a Draft shots panel listing generated shot slots with status/category and pose details when a revision exists. Full post-create count/pose-set editing is intentionally deferred because draft shot add/remove/re-materialization needs a separate safe slice.
