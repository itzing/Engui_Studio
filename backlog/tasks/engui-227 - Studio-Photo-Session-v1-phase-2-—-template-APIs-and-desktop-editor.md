---
id: ENGUI-227
title: Studio Photo Session v1 phase 2 — template APIs and desktop editor
status: Inbox
assignee: []
created_date: '2026-05-06 18:21'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-226
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the saved-template surface for Studio Photo Session: desktop route shell, template CRUD APIs, autosaved draft behavior, explicit save flow, and the first template editor UI. The editor should cover the approved v1 fields only and stay separate from run behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Users can create, load, autosave, explicitly save, and duplicate studio-session templates in a dedicated desktop surface.
- [ ] #2 The template editor supports character selection from Character Manager plus inline environment, outfit, hairstyle, prompt, generation, and resolution-policy fields.
- [ ] #3 Category counts are edited through a compact scrollable slider panel with one slider per category in the 0..20 range.
- [ ] #4 Create Run uses the saved template state, not unsaved editor-only draft state.
<!-- AC:END -->
