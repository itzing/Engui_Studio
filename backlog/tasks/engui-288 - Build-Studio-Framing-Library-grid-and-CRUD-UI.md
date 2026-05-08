---
id: ENGUI-288
title: Build Studio Framing Library grid and CRUD UI
status: Done
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

- [x] `/studio-sessions/framing-library` route exists.
- [x] Grid cards show title, orientation, aspect ratio, helper prompt summary, transform summary, tags, and placement thumbnail/placeholder.
- [x] Create/edit/duplicate/delete/reorder actions work through the framing APIs.
- [x] Empty/loading/error states are usable.
- [x] Mobile is explicitly out of scope or read-only for v1.

## Implementation Notes

Keep copy consistent: use “Framing”, not “Frame shot”, to avoid confusion with Studio shots.

## Completion Notes

- Added desktop route `/studio-sessions/framing-library` through `FStudioPageClient`.
- Added `FramingLibraryWorkspace` with grouped grid cards, relative placement preview, search/orientation filters, loading/empty/error states, and create/edit dialogs.
- Wired create, patch, duplicate, delete, and orientation-local reorder actions to existing framing preset APIs.
- Copy explicitly states mobile editor is out of scope for desktop v1.
- Verification: targeted Vitest suite passed; production Next build passed. Full `tsc --noEmit` still fails on pre-existing unrelated project type errors; no new `FramingLibraryWorkspace` errors after fix.
