---
id: ENGUI-272
title: Materialize Pose Library snapshots into Studio shots
status: To Do
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

- [ ] Shot/revision records store a snapshot of pose title/label, pose prompt, orientation, framing, camera angle, and shot distance at use time.
- [ ] Rerun/review prompt assembly can work from the stored snapshot without requiring the live library pose.
- [ ] Replace/reshuffle/new selections only use current non-deleted library records.
- [ ] Existing run creation UX is not redesigned.
- [ ] Regression tests cover snapshot creation and rerun behavior after the live pose is unavailable.
