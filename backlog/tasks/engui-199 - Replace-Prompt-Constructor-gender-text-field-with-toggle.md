---
id: ENGUI-199
title: Replace Prompt Constructor gender text field with toggle
status: Done
assignee: []
created_date: '2026-04-25 13:40'
labels:
  - frontend
  - ux
  - bug
dependencies: [ENGUI-198]
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the character-slot `genderPresentation` free-text input in Prompt Constructor with a simple binary toggle for `male` and `female`, matching the current product requirement. The underlying saved field can remain `genderPresentation` for compatibility, but the UI should no longer expose it as arbitrary text.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Character slot UI shows a simple `male` / `female` toggle instead of a free-text gender field
- [x] #2 Existing saved values continue to load without crashing
- [x] #3 Selecting a toggle updates the persisted `genderPresentation` field compatibly
- [x] #4 Regression coverage verifies the toggle behavior
<!-- AC:END -->
