---
id: ENGUI-229.6
title: >-
  Studio Photo Session phase 4.6 - surface exhausted-pose-pool UX for categories
  and slots
status: Inbox
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-229.3
  - ENGUI-229.4
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-229
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add explicit UX for exhausted unique-pose pools so users understand why some slots remain unassigned after automatic actions. The run should never silently fail or start repeating poses automatically.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 When a category runs out of unique automatically assignable poses, affected slots remain unassigned instead of reusing poses silently.
- [ ] #2 The run UI clearly surfaces that the category's unique automatic pose pool is exhausted.
- [ ] #3 Exhaustion handling works consistently for single-shot auto-pick, Assemble all, and reshuffle flows.
<!-- AC:END -->
