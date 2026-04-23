---
id: ENGUI-182
title: Run Prompt Constructor desktop QA and polish
status: Inbox
assignee: []
created_date: '2026-04-23 18:52'
labels:
  - frontend
dependencies: [ENGUI-179, ENGUI-180, ENGUI-181]
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Run the focused desktop QA and polish pass for Prompt Constructor v1 after the shell, structured editor, and library integrations land. Validate save/load, copy behavior, prompt rendering normalization, active-slot library insertion, constraint toggling, and regression risk around existing Character, Vibe, and Pose flows. Any follow-up polish should preserve the v1 guardrails: single-character only, no manual edit mode, and the final rendered prompt always visible.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Desktop QA covers create, save, reload, copy, slot editing, constraints, and library insertion flows
- [ ] #2 Rendered prompt output stays stable and normalized across common edit sequences
- [ ] #3 Existing Character, Vibe, and Pose manager flows do not regress because of Prompt Constructor integration work
- [ ] #4 Any polish fixes preserve the v1 scope boundaries instead of quietly expanding the feature
<!-- AC:END -->
