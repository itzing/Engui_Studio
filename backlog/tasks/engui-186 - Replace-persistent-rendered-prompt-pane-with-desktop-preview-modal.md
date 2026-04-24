---
id: ENGUI-186
title: Replace persistent rendered prompt pane with desktop preview modal
status: Inbox
assignee: []
created_date: '2026-04-24 09:11'
labels:
  - frontend
  - spec
dependencies: [ENGUI-183, ENGUI-185]
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the always-visible rendered prompt pane with an explicit desktop Preview action that opens the final rendered prompt in a large modal or drawer. The preview surface should feel like a focused inspection tool instead of permanent chrome, with a scrollable prompt panel, copy action, and visible validation warnings when present. Target the agreed desktop behavior: roughly 90 percent of screen height and 50 percent of screen width.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The rendered prompt is no longer permanently visible in the main Prompt Constructor layout
- [ ] #2 A Preview action opens a large desktop modal or drawer for the rendered prompt
- [ ] #3 The preview surface supports scrolling for long prompt output and includes copy affordance
- [ ] #4 Validation warnings remain visible from the preview flow when relevant
<!-- AC:END -->
