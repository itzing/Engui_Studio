---
id: ENGUI-188
title: Run desktop Prompt Constructor v2 QA and preset source cleanup
status: blocked
assignee: []
created_date: '2026-04-24 09:11'
labels:
  - frontend
  - spec
dependencies: [ENGUI-184, ENGUI-185, ENGUI-186, ENGUI-187]
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
This narrower QA and preset-cleanup pass is now superseded by the broader scene-template redesign captured in `docs/prompt-constructor-scene-template-v2-spec.md` and ENGUI-189 through ENGUI-196. Keep this ticket blocked unless the redesign is explicitly paused and the old desktop-only QA slice is revived.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 QA covers section rail navigation, active-slot editing, helper insertion, preview modal, and save/load flows
- [ ] #2 Section progress counts remain accurate as users edit slots
- [ ] #3 The desktop redesign does not regress Prompt Constructor persistence or document lifecycle behavior
- [ ] #4 Quick preset sourcing is cleaned up so the desktop v2 layout does not rely on a brittle inline page-level constant as its long-term model
<!-- AC:END -->
