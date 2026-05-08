---
id: ENGUI-293
title: Run final Studio Pose plus Framing Library QA build deploy and documentation pass
status: Done
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

- [x] Existing Studio run creation and text-only pose flows still work.
- [x] Pose OpenPose extraction works and stores encrypted keypoints.
- [x] Framing Library CRUD/editor works and stores aspect ratio plus relative transform only.
- [x] Run-level default/single/by-orientation framing resolves correctly.
- [x] OpenPose-enhanced shots send rendered control PNGs to Z-Image ControlNet.
- [x] Snapshot stability is verified after editing pose/framing records.
- [x] `npm test -- tests/lib/studio-sessions-utils.test.ts` passes.
- [x] `npm run build` passes.
- [x] `engui-studio.service` is restarted and smoke routes return 200.
- [x] Changes are committed and pushed.

## Implementation Notes

Smoke `/studio-sessions`, `/studio-sessions/pose-library`, `/studio-sessions/framing-library`, framing APIs, and representative run creation paths.

## QA Notes

- Targeted automated QA passed: `npm test -- tests/lib/studio-openpose-renderer.test.ts tests/lib/studio-sessions-utils.test.ts tests/lib/studio-sessions-server.test.ts` → 25 tests passed.
- Production build passed: `npm run build`.
- Integrated checks covered existing Studio Session server flows, OpenPose materialization without plaintext keypoint persistence, renderer behavior, framing policy persistence/resolution, safe preview route compilation, and text-only fallback path.
- Documentation updated to match implementation: safe control PNG preview is available; live paid Z-Image preview launch remains deferred until confirmation/budget UX is explicitly approved.
- Service restart and HTTP smoke were completed after commit/deploy.
