---
id: ENGUI-187
title: Turn desktop Prompt Constructor right pane into active-slot helper surface
status: Done
assignee: []
created_date: '2026-04-24 09:11'
labels:
  - frontend
  - spec
dependencies: [ENGUI-183, ENGUI-185, ENGUI-181]
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Turn the right half of the desktop Prompt Constructor into a helper surface that is fully driven by the currently active slot. This area should show quick presets, library/provider results, and slot-specific insertion options without forcing users to scroll away from the field they are editing. As part of the cleanup, stop treating hardcoded slot preset chips as an awkward pseudo-panel inside the form and align the helper area around a clearer active-slot model.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The right pane content updates based on the currently active slot
- [x] #2 Quick presets and library/provider suggestions are presented together as helper content for the active slot
- [x] #3 Users can insert helper content into the active slot without leaving the current editing context
- [x] #4 The helper surface no longer depends on a detached top-of-form preset panel pattern
<!-- AC:END -->
