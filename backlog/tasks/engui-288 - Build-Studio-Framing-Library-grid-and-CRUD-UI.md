---
id: ENGUI-288
title: Build Studio Framing Library grid and CRUD UI
status: Todo
assignee: []
created_date: '2026-05-08'
labels:
  - studio-sessions
  - framing-library
  - desktop
  - ui
priority: high
dependencies: 
  - ENGUI-285
---

## Description
Add the desktop Framing Library route and UI for browsing, creating, editing, duplicating, deleting, and reordering framing presets.

Reference:

- `docs/studio-frame-library-spec.md`
- `docs/studio-frame-library-implementation-plan.md`

## Acceptance Criteria

- [ ] `/studio-sessions/framing-library` route exists.
- [ ] Grid cards show title, orientation, aspect ratio, helper prompt summary, transform summary, tags, and placement thumbnail/placeholder.
- [ ] Create/edit/duplicate/delete/reorder actions work through the framing APIs.
- [ ] Empty/loading/error states are usable.
- [ ] Mobile is explicitly out of scope or read-only for v1.

## Implementation Notes

Keep copy consistent: use “Framing”, not “Frame shot”, to avoid confusion with Studio shots.
