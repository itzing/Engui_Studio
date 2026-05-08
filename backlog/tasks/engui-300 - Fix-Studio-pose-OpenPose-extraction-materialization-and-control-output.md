---
id: ENGUI-300
title: Fix Studio pose OpenPose extraction materialization and control output
status: Done
assignee: []
created_date: '2026-05-08 14:16'
labels:
  - studio-sessions
  - pose-library
  - openpose
  - bug
dependencies: []
priority: high
completed_date: '2026-05-08 14:28'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
OpenPose extraction from pose preview produced a line-art style image instead of OpenPose control skeleton and did not appear under the pose preview after job completion. Fix the extraction/task/materialization flow so pose OpenPose data is saved and displayed correctly.
<!-- SECTION:DESCRIPTION:END -->

## Resolution

- Fixed Z-Image RunPod payload mapping so `task_type: openpose_extract` is also sent as `task: openpose_extract`, matching the deployed endpoint handler's workflow switch.
- Pose OpenPose extraction route now submits explicit DWPose/OpenPose workflow parameters: body, hands, face detection enabled and 1024 resolution.
- Preserved those OpenPose-specific parameters through `submitGenerationFormData` for `z-image` extraction jobs.
- Validation: production build passed. Live extraction was not launched.
