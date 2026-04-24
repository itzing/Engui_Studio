---
id: ENGUI-190
title: Rework Prompt Constructor save/load/search and duplication around scenes
status: Inbox
assignee: []
created_date: '2026-04-24 16:45'
labels:
  - frontend
  - backend
dependencies: [ENGUI-189]
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Rework the current Prompt Constructor persistence and list UX so users are working with saved scenes rather than generic prompt documents. Reuse the existing Prompt Constructor persistence shell where possible, but make the list, search, open, duplicate, and save flows scene-oriented and backed by metadata that can be queried without downloading every full scene payload. The saved-scene experience should expose title, scene type, tags, character count, and updated time, while still supporting the underlying template-capable architecture.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Prompt Constructor list and toolbar flows are presented as saved scenes rather than generic prompt documents
- [ ] #2 Users can search and open saved scenes by title, scene type, tags, character count, and recency
- [ ] #3 Scene duplication works as a first-class flow and produces a separate editable saved scene
- [ ] #4 The UI does not need to download every full scene payload just to render the saved-scene list
- [ ] #5 The scene-oriented save/load flows remain compatible with the existing template-aware persistence architecture
<!-- AC:END -->
