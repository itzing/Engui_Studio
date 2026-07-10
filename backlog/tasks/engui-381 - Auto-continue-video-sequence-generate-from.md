---
id: engui-381
title: Auto-continue video sequence generate from
status: Done
created: 2026-07-10
updated: 2026-07-10
---

## Goal

Make desktop Video Sequence Builder Generate from selected run the selected range as a sequential chain instead of only queueing one segment.

## Acceptance Criteria

- [x] After the first segment is queued, the UI waits for that segment to finish and sync.
- [x] The next segment is generated only after the previous segment has `outputVideoUrl` and `lastFrameUrl`.
- [x] Regenerate-all setup does not re-mark already regenerated completed segments stale on every continuation call.
- [x] Steps override remains applied across the whole selected range.
- [x] Queued/processing segments are not duplicated.
- [x] Focused regression tests pass.
- [x] Production build passes and `engui-studio.service` is restarted.

## Rollback

Revert the implementation commit, rebuild the app, and restart `engui-studio.service`.

## Result

Generate from selected now starts a client-side sequential auto-run. The initial request can prepare all completed segments for regeneration, but follow-up continuation calls only target remaining `draft`, `failed`, and `stale` segments so completed segments are not re-marked stale in a loop. The UI waits while any segment is queued or processing, relies on the existing status sync path to materialize output and continuation frames, then queues the next segment only after the previous segment has `outputVideoUrl` and `lastFrameUrl`.
