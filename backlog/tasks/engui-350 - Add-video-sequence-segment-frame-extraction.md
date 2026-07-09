---
id: engui-350
title: Add video sequence segment frame extraction
status: Done
assignee: Rocky
created: 2026-07-09
---

## Summary

Extract and persist first/last frame images from completed Video Sequence segment videos so downstream `previous_last_frame` segments can use the generated last frame as their source.

## Acceptance Criteria

- [x] Add a server helper that materializes first/last frame images from a completed segment `outputVideoUrl`.
- [x] Add an API route to extract/sync segment frames without launching new RunPod jobs.
- [x] Update segment status sync so a completed video job can populate `outputVideoUrl`, `firstFrameUrl`, and `lastFrameUrl`.
- [x] Add a desktop UI action to refresh/extract frames for the selected segment.
- [x] Add focused tests for successful frame extraction and missing-output rejection.
- [x] Production build passes.

## Notes

- Scope is desktop Video Sequences only.
- Do not launch live RunPod validation jobs during implementation.
- Rollback: revert the implementation commit, rebuild, and restart `engui-studio.service`.
