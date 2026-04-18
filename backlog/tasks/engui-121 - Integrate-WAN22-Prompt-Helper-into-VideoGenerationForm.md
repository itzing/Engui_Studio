---
id: ENGUI-121
title: Integrate WAN 2.2 Prompt Helper into VideoGenerationForm
status: Inbox
assignee: []
created_date: '2026-04-18 21:06'
labels:
  - prompt-helper
  - frontend
  - video
  - wan22
  - ux
dependencies:
  - ENGUI-120
references:
  - /home/engui/Engui_Studio/specs/prompt-helper-mvp-spec.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add Prompt Helper UI to the video generation flow for WAN 2.2.

When the active video model is WAN 2.2, the user should be able to click a helper button, describe what they want in the video, and have the existing Prompt Helper model rewrite or generate the main video prompt according to WAN 2.2-specific prompting guidance.

Match the proven image Prompt Helper UX where practical: modal instruction entry, loading/error handling, keyboard submit, and immediate prompt replacement on success.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 VideoGenerationForm shows a Prompt Helper entry point for WAN 2.2
- [ ] #2 The helper can generate a new WAN 2.2 prompt when the video prompt is empty
- [ ] #3 The helper can rewrite the current WAN 2.2 prompt when the user gives an edit instruction
- [ ] #4 Success replaces the main video prompt immediately
- [ ] #5 Failure keeps the instruction intact for retry and does not clear the current prompt
- [ ] #6 No new Prompt Helper settings section is introduced for WAN 2.2 specifically
<!-- AC:END -->
