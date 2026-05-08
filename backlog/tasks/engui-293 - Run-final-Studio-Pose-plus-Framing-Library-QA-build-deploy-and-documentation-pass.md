---
id: ENGUI-293
title: Run final Studio Pose plus Framing Library QA build deploy and documentation pass
status: Todo
assignee: []
created_date: '2026-05-08'
labels:
  - studio-sessions
  - framing-library
  - pose-library
  - qa
  - deploy
priority: high
dependencies: 
  - ENGUI-284
  - ENGUI-285
  - ENGUI-286
  - ENGUI-287
  - ENGUI-288
  - ENGUI-289
  - ENGUI-290
  - ENGUI-291
  - ENGUI-292
---

## Description
Perform final integrated QA for OpenPose-enhanced poses and run-level orientation-aware framing, then build, deploy, smoke test, and update docs if implementation differs.

Reference:

- `docs/studio-frame-library-spec.md`
- `docs/studio-frame-library-implementation-plan.md`

## Acceptance Criteria

- [ ] Existing Studio run creation and text-only pose flows still work.
- [ ] Pose OpenPose extraction works and stores encrypted keypoints.
- [ ] Framing Library CRUD/editor works and stores aspect ratio plus relative transform only.
- [ ] Run-level default/single/by-orientation framing resolves correctly.
- [ ] OpenPose-enhanced shots send rendered control PNGs to Z-Image ControlNet.
- [ ] Snapshot stability is verified after editing pose/framing records.
- [ ] `npm test -- tests/lib/studio-sessions-utils.test.ts` passes.
- [ ] `npm run build` passes.
- [ ] `engui-studio.service` is restarted and smoke routes return 200.
- [ ] Changes are committed and pushed.

## Implementation Notes

Smoke `/studio-sessions`, `/studio-sessions/pose-library`, `/studio-sessions/framing-library`, framing APIs, and representative run creation paths.
