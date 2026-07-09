---
id: engui-349
title: Add video sequence segment generation prep
status: Done
assignee: Rocky
created: 2026-07-08
---

## Summary

Wire the desktop Video Sequence Builder to queue WAN22 image-to-video jobs from saved sequence segments, persist generation job metadata, and sync segment status from existing job records.

## Acceptance Criteria

- [x] Add server helpers for resolving segment source frames and building WAN22 generation payloads.
- [x] Add a segment generation API that validates source frames, submits through the existing generation path, and stores `generationJobId`.
- [x] Add a status sync API/helper that maps existing job state back onto a segment without launching new jobs.
- [x] Connect the desktop `/video-sequences` UI to Generate selected and status refresh actions.
- [x] Add focused API/domain tests for payload building, missing-source rejection, and job status sync.
- [x] Production build passes.

## Notes

- Scope is desktop only.
- Do not launch live RunPod validation jobs during implementation.
- Rollback: revert the implementation commit, rebuild, and restart `engui-studio.service`.
