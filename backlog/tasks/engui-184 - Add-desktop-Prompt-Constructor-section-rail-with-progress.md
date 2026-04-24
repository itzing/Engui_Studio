---
id: ENGUI-184
title: Add desktop Prompt Constructor section rail with progress
status: Done
assignee: []
created_date: '2026-04-24 09:11'
labels:
  - frontend
  - spec
dependencies: [ENGUI-183]
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a narrow vertical navigation rail on the left side of the desktop Prompt Constructor for prompt section groups such as Character, Action, Composition, Environment, Style, and Constraints. Each item should include an icon, a short label, and a completion indicator like 2/3 so users can jump between sections without losing context in a long scroll. The rail should also surface the active section and warn when a section contains validation issues.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The desktop Prompt Constructor shows a narrow left rail with section items instead of a wide utility sidebar
- [x] #2 Each section item shows icon, label, and filled-slots progress such as 2/3
- [x] #3 Clicking a rail item jumps to and activates the corresponding section in the editor
- [x] #4 The rail visually distinguishes active, incomplete, complete, and warning states
<!-- AC:END -->
