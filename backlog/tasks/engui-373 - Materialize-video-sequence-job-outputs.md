---
id: engui-373
title: Materialize video sequence job outputs
status: Done
created: 2026-07-09
updated: 2026-07-09
---

## Goal

Make completed sequencer jobs independent from the source job row and job artifact cleanup.

## Acceptance Criteria

- [x] When a completed generation job is accepted by a video sequence segment, the segment stores its own output copy under the video sequence folder.
- [x] The segment snapshot preserves job/output metadata needed for later reuse and debugging.
- [x] Deleting the original finished job does not delete files that are still referenced by video sequence segments or final sequence renders.
- [x] Focused regression tests pass.
- [x] Production build passes and `engui-studio.service` is restarted.

## Rollback

Revert the implementation commit, rebuild the app, and restart `engui-studio.service`.

## Result

Completed job sync now materializes the job result into a sequence-owned segment output file, records the original job/output metadata in `generationSnapshotJson`, and job artifact cleanup keeps files referenced by video sequences.
