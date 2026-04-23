---
id: ENGUI-172
title: Add Save draft and Add to gallery actions to preview and job details
status: Inbox
assignee: []
created_date: '2026-04-23 09:05'
labels:
  - gallery
  - frontend
  - mobile
dependencies:
  - ENGUI-171
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expose the new semantic save actions in the UI. Both the center preview and the job details dialog should show explicit Save draft and Add to gallery actions. The UI should disable or adapt each action based on the bucket-aware saved-state returned by the job API, rather than treating gallery presence as a single boolean. Mobile can use shorter labels if needed, but the semantic distinction must remain explicit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Center preview shows both Save draft and Add to gallery actions
- [ ] #2 Job details dialog shows both Save draft and Add to gallery actions
- [ ] #3 Each action reflects bucket-specific save state instead of one global already in gallery flag
- [ ] #4 Mobile presentation remains usable without hiding the semantic difference between the two actions
<!-- AC:END -->
