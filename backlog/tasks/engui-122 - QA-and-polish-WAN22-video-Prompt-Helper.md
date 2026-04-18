---
id: ENGUI-122
title: QA and polish WAN 2.2 video Prompt Helper
status: Inbox
assignee: []
created_date: '2026-04-18 21:06'
labels:
  - prompt-helper
  - qa
  - video
  - wan22
  - ux
dependencies:
  - ENGUI-120
  - ENGUI-121
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Run a focused QA and polish pass on the WAN 2.2 video Prompt Helper flow.

Verify that narrow edits stay narrow, empty-prompt generation produces WAN 2.2-friendly prompts, long instructions do not break the JSON-only contract, and the overall UX is reliable enough for repeated prompt iteration inside the video workflow.

Document any remaining prompt-shaping edge cases or follow-up tuning opportunities separately if needed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 QA covers empty-prompt generation and edit-existing-prompt flows
- [ ] #2 QA covers narrow edit instructions versus broader rewrite/generate instructions
- [ ] #3 Helper output is English final prompt text without markdown or explanation leakage
- [ ] #4 UX is validated for loading, error, retry, and immediate apply behavior
- [ ] #5 Any remaining doc-driven tuning gaps are captured as explicit follow-up items
<!-- AC:END -->
