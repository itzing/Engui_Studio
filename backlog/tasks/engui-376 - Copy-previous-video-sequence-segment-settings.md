---
id: engui-376
title: Copy previous video sequence segment settings
status: Done
created: 2026-07-09
updated: 2026-07-09
---

## Goal

When adding a new Video Sequence Builder segment, inherit generation settings from the previous segment so chained segments start from the same prompt/model/seed/LoRA setup.

## Acceptance Criteria

- [x] New non-first segments copy prompt, motion, continuity, model, endpoint, LoRA config, generation options, seed, randomize flag, and duration from the previous segment.
- [x] New non-first segments still use `previous_last_frame` as their source mode by default.
- [x] Explicit create request fields can override copied defaults.
- [x] First segment creation still uses standard defaults.
- [x] Focused regression tests pass.
- [x] Production build passes and `engui-studio.service` is restarted.

## Rollback

Revert the implementation commit, rebuild the app, and restart `engui-studio.service`.

## Result

New Video Sequence Builder follow-up segments now inherit generation settings from the previous segment while keeping the default chained source mode.
