---
id: ENGUI-32
title: Character Manager apply saved version to draft
status: Done
assignee: []
created_date: '2026-04-11 15:34'
updated_date: '2026-04-11 15:36'
labels:
  - character-manager
  - engui
  - ui
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement read-only version history actions that let the user apply any saved CharacterVersion snapshot into the current transient draft without mutating history directly. Keep version history immutable, make the selected snapshot visible, and preserve v1 save semantics where saving after apply creates a new version only if traits differ from current saved character state.
<!-- SECTION:DESCRIPTION:END -->
