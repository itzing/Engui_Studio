---
id: ENGUI-294
title: Fix Studio pose preview seed and materialization
status: Done
assignee: []
created_date: '2026-05-08 13:37'
updated_date: '2026-05-08 13:40'
labels:
  - studio-sessions
  - pose-library
  - preview
  - bug
dependencies: []
priority: high
completed_date: '2026-05-08 13:43'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pose preview generation currently queues multiple variants with the same default seed, producing identical images. Completed preview jobs also do not reliably appear as pose preview candidates after completion. Fix random seed assignment per preview job and ensure completed studio_pose_preview materialization creates candidates and updates the pose.
<!-- SECTION:DESCRIPTION:END -->

## Resolution

- Pose preview queue endpoints now set `randomizeSeed=true`, and server-side generation honors it by replacing the submitted/default `seed` before RunPod submission.
- Pose preview materialization now falls back to the original job output URL if copying into the pose-library directory fails, so candidates still appear instead of failing the task.
- Fixed local `public/generations/studio-pose-library` ownership and recovered the four failed completed preview jobs into pose preview candidates.
- Validation: targeted Studio tests passed (26 tests) and production build passed.
