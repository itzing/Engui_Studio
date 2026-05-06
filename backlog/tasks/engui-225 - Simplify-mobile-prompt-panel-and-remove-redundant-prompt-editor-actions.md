---
id: ENGUI-225
title: Simplify mobile prompt panel and remove redundant prompt editor actions
status: Inbox
assignee: []
created_date: '2026-05-06 14:15'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On the mobile create screen, remove the bottom action button for opening the focused prompt editor. Collapse the prompt summary panel to a single line in the format "Prompt: ...", showing "Empty" when no prompt exists and otherwise the beginning of the current prompt. Remove the separate "Edit prompt" button from the prompt panel and make tapping the panel itself open the prompt editor.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The bottom 'open focused prompt editor' button is removed on mobile create.
- [ ] #2 The prompt panel renders as a single-line summary starting with 'Prompt:' and shows 'Empty' when blank.
- [ ] #3 Tapping the prompt panel opens the mobile prompt editor without a separate edit button.
<!-- AC:END -->
