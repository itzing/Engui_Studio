---
id: ENGUI-290
title: Add run-level orientation-aware framing policy selector
status: Todo
assignee: []
created_date: '2026-05-08'
labels:
  - studio-sessions
  - framing-library
  - runs
  - ui
priority: high
dependencies: 
  - ENGUI-285
  - ENGUI-288
---

## Description
Extend Studio run creation/settings so a run can select a framing policy in addition to the existing pose set/category.

Reference:

- `docs/studio-frame-library-spec.md`
- `docs/studio-frame-library-implementation-plan.md`

## Acceptance Criteria

- [ ] Existing run creation works with default centered framing.
- [ ] User can choose `Default centered`, `Single preset for all orientations`, or `By orientation`.
- [ ] By-orientation mode supports portrait, landscape, and square preset slots.
- [ ] Resolution order is clear: orientation-specific preset, fallback preset, default centered.
- [ ] Run summary displays the chosen framing policy.

## Implementation Notes

Store policy in existing run settings/options if that reduces migration risk. No per-shot manual framing in v1.
