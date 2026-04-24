---
id: ENGUI-185
title: Rework desktop Prompt Constructor editor into section-focused slots column
status: Inbox
assignee: []
created_date: '2026-04-24 09:11'
labels:
  - frontend
  - spec
dependencies: [ENGUI-183, ENGUI-184]
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Rework the main Prompt Constructor editor into a section-focused slots column that uses most of the available width for actual editing. The editor should group slots under section headers, keep the active slot visually obvious, and support efficient movement between sections selected from the left rail. This ticket is about the center editing experience itself, not the preview modal or helper suggestion content.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The center column uses the majority of layout space for slot editing
- [ ] #2 Slots are grouped by section and align with the left navigation rail structure
- [ ] #3 The active slot is clearly highlighted while editing
- [ ] #4 Navigating from the rail keeps the editor focused on the selected section without awkward long-scroll-only behavior
<!-- AC:END -->
