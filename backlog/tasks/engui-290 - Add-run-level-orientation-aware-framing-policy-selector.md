---
id: ENGUI-290
title: Add run-level orientation-aware framing policy selector
status: Done
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

- [x] Existing run creation works with default centered framing.
- [x] User can choose `Default centered`, `Single preset for all orientations`, or `By orientation`.
- [x] By-orientation mode supports portrait, landscape, and square preset slots.
- [x] Resolution order is clear: orientation-specific preset, fallback preset, default centered.
- [x] Run summary displays the chosen framing policy.

## Implementation Notes

Store policy in existing run settings/options if that reduces migration risk. No per-shot manual framing in v1.

## Completion Notes

- Added a run-creation framing policy selector to `FStudioPageClient`.
- Supported modes: default centered, single preset fallback for all orientations, and by-orientation slots for portrait/landscape/square with fallback.
- Stored policy inside existing run `generationSettings.framingPolicy` / run settings JSON to avoid schema migration risk.
- Run detail summary now displays the resolved policy shape and clarifies selected preset titles when loaded.
- Verified production build and API create/delete probe with a temporary framing preset and run; no launch/generation jobs were started.
