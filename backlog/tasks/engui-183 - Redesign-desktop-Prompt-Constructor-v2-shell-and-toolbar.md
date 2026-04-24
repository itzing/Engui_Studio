---
id: ENGUI-183
title: Redesign desktop Prompt Constructor v2 shell and toolbar
status: Done
assignee: []
created_date: '2026-04-24 09:11'
labels:
  - frontend
  - spec
dependencies: [ENGUI-176, ENGUI-177, ENGUI-178]
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Redesign the desktop Prompt Constructor shell around a v2 layout that prioritizes slot editing instead of keeping the rendered prompt permanently visible. Replace the current shell with a compact top toolbar for document actions, a narrow left navigation rail for prompt sections, a main editor column for slot inputs, and a right-side helper area dedicated to the currently active slot. The rendered prompt must move out of the persistent layout and become an on-demand preview flow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The desktop shell uses a compact top toolbar for document selection and actions such as Save, Duplicate, New, and Preview
- [x] #2 The permanent rendered prompt pane is removed from the main layout
- [x] #3 The primary layout visibly prioritizes slot editing and active-slot helper content over passive prompt output
- [x] #4 The v2 shell remains desktop-only and does not change mobile Prompt Constructor behavior
<!-- AC:END -->
