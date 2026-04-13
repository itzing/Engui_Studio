---
id: ENGUI-70
title: Add Vibe Manager prompt extraction flow
status: Todo
assignee: []
created_date: '2026-04-13 19:27'
updated_date: '2026-04-13 19:27'
labels:
  - engui
  - vibe-manager
  - extraction
  - llm
dependencies:
  - ENGUI-68
  - ENGUI-69
priority: high
---

## Description

Add the MVP prompt-to-vibe extraction flow for Vibe Manager.

Requirements:
- add a small `Extract from Prompt` action instead of a persistent right panel
- open extraction in a small modal with multiline prompt input
- submit with button and `Ctrl+Enter`
- disable other global `Ctrl+Enter` handlers while the modal is active
- use the same blocking/loading interaction style as Prompt Helper
- on success, create a new extracted draft and fully replace the current editor state with no preview or merge flow
- on success, close the modal automatically
- on error, keep the modal open, preserve the entered prompt, show the error inline, and expose a copy-error action
- keep extraction output limited to `name`, `baseDescription`, `tags`, `compatibleSceneTypes`, and internal `confidence`
- do not show confidence in the MVP UI
