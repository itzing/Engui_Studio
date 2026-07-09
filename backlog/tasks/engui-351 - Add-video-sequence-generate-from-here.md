---
id: engui-351
title: Add video sequence Generate from here
status: Done
assignee: Rocky
created: 2026-07-09
---

## Summary

Add a server-side Generate from here coordinator for desktop Video Sequences so a selected segment can advance a sequence safely without relying on a browser-only loop.

## Acceptance Criteria

- [x] Add `POST /api/video-sequences/:id/generate-from`.
- [x] Generate only `draft`, `failed`, or `stale` segments from the selected segment forward.
- [x] Sync existing queued/processing segments instead of launching duplicate jobs.
- [x] Require a previous completed segment with `lastFrameUrl` before generating `previous_last_frame` segments.
- [x] Stop on the first failure or blocked segment and leave following segments unchanged.
- [x] Add a desktop UI action for Generate from here.
- [x] Add focused API tests.
- [x] Production build passes.

## Notes

- Scope is desktop Video Sequences only.
- Do not launch live RunPod validation jobs during implementation.
- Rollback: revert the implementation commit, rebuild, and restart `engui-studio.service`.

## Result

Implemented a server-side Generate from here coordinator that queues one eligible segment at a time, syncs existing in-flight segment jobs, waits for previous `lastFrameUrl` when needed, and stops on blocked or failed segments without mutating downstream drafts. Added the desktop header and inspector actions.
