---
id: engui-352
title: Add video sequence staleness rules
status: Done
assignee: Rocky
created: 2026-07-09
---

## Summary

Mark Video Sequence segments as stale when generated outputs no longer match their current upstream source or generation settings, while preserving existing output videos.

## Acceptance Criteria

- [x] Mark downstream `previous_last_frame` segments as `stale` when an upstream `lastFrameUrl` changes.
- [x] Do not mark frozen-source segments stale from upstream changes.
- [x] Keep existing `outputVideoUrl`, frame URLs, and generation job metadata visible when a segment becomes stale.
- [x] Mark a generated segment stale when generation-relevant settings change after it has output.
- [x] Add focused tests for downstream and self-staleness behavior.
- [x] Production build passes.

## Notes

- Scope is desktop Video Sequences only.
- Do not launch live RunPod validation jobs during implementation.
- Rollback: revert the implementation commit, rebuild, and restart `engui-studio.service`.

## Result

Implemented server-side staleness propagation for downstream `previous_last_frame` chains and self-staleness for generated segments whose generation-relevant settings change. Stale segments keep their existing media and job metadata visible.
