---
id: ENGUI-180
title: Build Prompt Constructor slots and constraints editing UI
status: Inbox
assignee: []
created_date: '2026-04-23 18:52'
labels:
  - frontend
dependencies: [ENGUI-177, ENGUI-179]
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the structured editing experience for Prompt Constructor v1. The Slots tab must expose the single-character template sections for Character, Action, Composition, Environment, and Style, while the Constraints tab must expose the reusable constraint checklist with stable ordering and template defaults. Editing slot values or toggling constraints should update the rendered prompt immediately, with no manual prompt-edit surface and no mode switch that hides the final prompt.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The Slots tab exposes the v1 fields for appearance, outfit, expression, pose, main action, composition, environment, and style
- [ ] #2 The Constraints tab exposes template-default constraints with enable or disable behavior
- [ ] #3 Editing slot values or constraints updates the rendered prompt immediately
- [ ] #4 The UI does not introduce manual prompt editing, negative prompt mode, or a mode switch that hides the final prompt
<!-- AC:END -->
