---
id: ENGUI-41
title: Character Manager three-column layout with preview rail
status: In Progress
assignee: []
created_date: '2026-04-12 11:48'
updated_date: '2026-04-12 11:48'
labels:
  - character-manager
  - engui
  - ui
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Rework Character Manager into a clearer three-column workspace.

Layout spec:
- Left column: character navigation only. Include search, sort, New, Import, Active/Trash switch, and the character list.
- Center column: compact editor only. Keep character actions, basics, and trait groups readable without stretching across the full dialog width.
- Right column: three vertically stacked preview cards. They should stay visually stable and act as preview rail for the selected character.

Detailed requirements:
- Remove the current full-width stacked feeling where list, editor, assistant, and history all stretch across the dialog.
- Keep Clone, Delete, Restore, Cancel, and Save available, but place them near the active draft header in the center column.
- Keep trait editing modal-based for now, but show each trait group as a compact summary card with counts and a short value preview.
- De-emphasize secondary sections. Assistant draft edit, version history, and legacy traits should be present but collapsed or visually secondary.
- Preserve existing flows and semantics: create, save, import, clone, version history apply-to-draft, trash/restore, locks, and keyboard selection in the list.
- Do not invent backend preview generation in this ticket. If real rendered previews are not available yet, use stable preview cards/empty states that still make the right rail useful and readable.
<!-- SECTION:DESCRIPTION:END -->
