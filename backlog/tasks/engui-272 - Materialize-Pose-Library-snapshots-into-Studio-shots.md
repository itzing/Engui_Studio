---
id: ENGUI-272
title: Materialize Pose Library snapshots into Studio shots
status: Done
assignee: []
created_date: '[PosixPath('backlog/tasks/engui-270 - Add-persisted-Studio-Pose-Library-schema-and-domain-types.md'), PosixPath('backlog/tasks/engui-271 - Seed-current-static-pose-library-into-persisted-Pose-Library.md')]'
labels:
  - studio-sessions
  - pose-library
  - desktop
  - data
  - generation
priority: high
dependencies: 
  - ENGUI-270
---

## Description

Harden Studio shot creation/rerun behavior so library pose edits/deletes do not break existing shots.

Reference:

- `docs/studio-pose-library-spec.md`
- `docs/studio-pose-library-implementation-plan.md`

## Acceptance Criteria

- [x] Shot/revision records store a snapshot of pose title/label, pose prompt, orientation, framing, camera angle, and shot distance at use time.
- [x] Rerun/review prompt assembly can work from the stored snapshot without requiring the live library pose.
- [x] Replace/reshuffle/new selections only use current non-deleted library records.
- [x] Existing run creation UX is not redesigned.
- [x] Regression tests cover snapshot creation and rerun behavior after the live pose is unavailable.

## Implementation Notes

Studio shot pose selection now uses persisted workspace pose records through DB-backed pose snapshots. New run pose sets are built from persisted Pose Library categories; shot revisions still save poseSnapshotJson and assembledPromptSnapshotJson, so later pose edits do not mutate existing shots.
