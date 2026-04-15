---
id: ENGUI-76
title: Add one-click saved Prompt Helper apply action
status: Inbox
assignee: []
created_date: '2026-04-15 10:08'
labels:
  - ui
  - prompt-helper
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a secondary magic-wand action next to Prompt Helper in ImageGenerationForm. When a saved Prompt Helper instruction exists in localStorage, enable the quick-apply button and let it submit the saved instruction without opening the dialog. During execution, lock the prompt panel and both helper buttons. On success, write the result into the main prompt field and show a subtle completion animation. On failure, open the Prompt Helper dialog and surface the error/debug state there.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Show a magic-wand quick-apply button next to Prompt Helper.
- [ ] #2 Enable the quick-apply button only when a saved Prompt Helper instruction exists.
- [ ] #3 Quick-apply must reuse the same backend flow as normal Prompt Helper apply with the saved instruction.
- [ ] #4 During quick-apply, block the prompt panel, Prompt Helper button, and quick-apply button until the request completes.
- [ ] #5 On success, update the prompt field and show a subtle completion animation without opening the dialog.
- [ ] #6 On failure, open the Prompt Helper dialog and display the error.
<!-- AC:END -->
