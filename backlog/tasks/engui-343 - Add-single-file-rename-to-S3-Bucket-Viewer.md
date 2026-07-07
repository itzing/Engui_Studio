---
id: engui-343
title: Add single-file rename to S3 Bucket Viewer
status: Done
assignee: Rocky
created: 2026-07-07
---

## Summary

Add a desktop Bucket Viewer action that appears when exactly one file is selected, opens a rename dialog prefilled with the current file name, and renames the object in S3.

## Acceptance Criteria

- [x] Bucket Viewer shows a Rename action only when one selected item is a file.
- [x] Rename opens a modal dialog with the current file name prefilled.
- [x] Confirming rename copies the S3 object to the same prefix with the new file name and deletes the old object.
- [x] Rename rejects empty names, folder separators, unchanged names, and destination collisions.
- [x] The current folder refreshes after a successful rename and selection/preview move to the renamed key.
- [x] Focused tests and production build pass.

## Notes

- Bucket Viewer is currently a desktop-only dialog opened from the left panel.
- Rollback: revert the implementation commit, rebuild, and restart `engui-studio.service`.
