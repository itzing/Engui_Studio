---
id: ENGUI-303
title: Replace Framing Library point editor with subject rectangle
status: Done
assignee: []
created_date: '2026-05-08 15:54'
labels:
  - studio-sessions
  - framing
  - desktop
  - ux
priority: high
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the Framing Library center-point visualization with a subject-area rectangle. The rectangle should start as a body-area box on the canvas, be draggable for placement, resizable for pose height, and continue to store relative framing values (`centerX`, `centerY`, `poseHeight`, `rotationDeg`, `flipX`) without pixel dimensions.
<!-- SECTION:DESCRIPTION:END -->

## Scope

- Desktop Framing Library editor/card preview only.
- Show subject rectangle instead of point in preset cards and editor canvas.
- Drag rectangle to change `centerX`/`centerY`.
- Resize rectangle to change `poseHeight`.
- Keep existing sliders as numeric controls.
- Update safe framing preview to use stored OpenPose PNG when available.
