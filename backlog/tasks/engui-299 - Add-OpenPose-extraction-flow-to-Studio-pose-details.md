---
id: ENGUI-299
title: Add OpenPose extraction flow to Studio pose details
status: Done
assignee: []
created_date: '2026-05-08 14:06'
updated_date: '2026-05-08 14:08'
labels:
  - studio-sessions
  - pose-library
  - openpose
  - ui
  - bug
dependencies: []
priority: high
completed_date: '2026-05-08 14:16'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pose detail needs a button to extract OpenPose data from the current primary preview. If there is no preview, show a modal that accepts file upload or pasted image, then run the same extraction job and save OpenPose data to the pose. Display OpenPose PNG as the main preview when there is no generated preview, and below the generated preview when one exists.
<!-- SECTION:DESCRIPTION:END -->

## Resolution

- Added Pose Detail action to queue OpenPose extraction from the current primary preview.
- If a pose has no primary preview, the action opens a modal with file picker and Ctrl+V image paste support; selected/pasted image uploads through `/api/upload` and then queues the same OpenPose extraction endpoint.
- Existing OpenPose data replacement uses the API confirmation flow with a browser confirm.
- Pose Detail now shows OpenPose PNG as fallback main preview when no generated preview exists, and as a secondary panel below the generated preview when both exist.
- After queueing extraction, the pose detail polls until OpenPose data is saved and updates the displayed preview/status.
- Validation: production build passed.
