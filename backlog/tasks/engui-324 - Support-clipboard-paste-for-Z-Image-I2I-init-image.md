---
id: ENGUI-324
title: Support clipboard paste for Z-Image I2I init image
status: Done
assignee: []
created_date: '2026-05-12'
labels:
  - create
  - z-image
  - i2i
  - desktop
  - ux
priority: high
---

## Description

Ctrl+V image paste does not populate the Z-Image image-to-image init image field on desktop Create Image. Add clipboard image paste support without changing normal upload or drag-and-drop behavior.

## Acceptance Criteria

- [x] Z-Image I2I mode accepts an image from clipboard with Ctrl+V as the primary init image.
- [x] Pasted init image shows the preview and sets dimensions just like upload/drag-drop.
- [x] Clipboard paste does not steal text paste inside prompt/input fields.
- [x] Build passes, app is restarted, and change is committed/pushed.

## Implementation Notes

- Added a shared primary image setter for upload, drag/drop, and paste so all paths populate the init image preview and dimensions consistently.
- Added a paste handler to the primary image dropzone plus a Z-Image I2I-only window paste listener that ignores prompt/input fields.
- Manual live generation was not run.

## Rollback

Revert the implementation commit, rebuild, and restart `engui-studio.service`.
