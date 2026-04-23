---
id: ENGUI-179
title: Build desktop Prompt Constructor shell and rendered prompt pane
status: Inbox
assignee: []
created_date: '2026-04-23 18:52'
labels:
  - frontend
  - spec
dependencies: [ENGUI-177, ENGUI-178]
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the desktop-first Prompt Constructor shell as a dedicated manager surface rather than reusing Scene Manager as the primary UX. The shell must load or create PromptDocument records, keep the rendered prompt always visible in the left pane, show save and copy actions, surface validation warnings, and host the right-side editor tabs for Slots, Library, and Constraints. This ticket covers the overall shell, document lifecycle wiring, and read-only rendered prompt pane, but not the full detailed editor behaviors inside each tab.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Desktop users can open the Prompt Constructor shell and create or load a PromptDocument
- [ ] #2 The left pane keeps the rendered prompt visible at all times while editing
- [ ] #3 The shell exposes save and copy actions plus visible save state or validation warnings
- [ ] #4 The shell provides the tab structure for Slots, Library, and Constraints without depending on Scene Manager UX
<!-- AC:END -->
