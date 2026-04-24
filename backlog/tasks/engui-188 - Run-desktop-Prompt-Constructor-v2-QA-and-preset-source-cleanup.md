---
id: ENGUI-188
title: Run desktop Prompt Constructor v2 QA and preset source cleanup
status: Inbox
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
Run QA and polish for the desktop Prompt Constructor v2 redesign after the new shell, section rail, preview flow, and active-slot helper surface land. Validate section navigation, section progress counts, active-slot suggestion behavior, preview modal behavior, save/load flows, and regressions around existing Prompt Constructor persistence. As part of the polish pass, clean up the current quick-preset source so it is no longer a fragile inline page constant and is ready to live in a dedicated preset/provider layer.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 QA covers section rail navigation, active-slot editing, helper insertion, preview modal, and save/load flows
- [ ] #2 Section progress counts remain accurate as users edit slots
- [ ] #3 The desktop redesign does not regress Prompt Constructor persistence or document lifecycle behavior
- [ ] #4 Quick preset sourcing is cleaned up so the desktop v2 layout does not rely on a brittle inline page-level constant as its long-term model
<!-- AC:END -->
