---
id: ENGUI-269
title: Randomize F-Studio pose selection
status: Done
assignee: []
created_date: '2026-05-07 22:11'
labels:
  - studio-sessions
  - desktop
priority: high
---

## Description

F-Studio run shot count should control how many draft shots are created, but the actual poses selected for those shots should be randomized from the selected pose set instead of deterministically taking the first N poses in library order.

## Acceptance Criteria

- Auto-pick and run assembly choose from the eligible pose set randomly while still respecting include/exclude filters and preferred framing/orientation weights.
- Poses remain unique within a run/category until the eligible pool is exhausted.
- Unit tests cover deterministic RNG injection so behavior is testable without relying on global randomness.

## Implementation Notes

- `pickUniqueStudioSessionPose` now randomly selects from the highest-priority eligible pose pool.
- Include/exclude filters and run/category auto-assignment history still prevent repeats until exhausted.
- Added deterministic RNG injection for tests.
