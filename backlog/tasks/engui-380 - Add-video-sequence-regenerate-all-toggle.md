---
id: engui-380
title: Add video sequence regenerate all toggle
status: Done
created: 2026-07-10
updated: 2026-07-10
---

## Goal

Allow Generate from selected to regenerate completed sequence segments when the user explicitly overrides the normal draft/failed/stale status filter.

## Acceptance Criteria

- [x] The Generate from selected modal has a checkbox to include completed segments.
- [x] Toggling the checkbox recalculates and updates the segment list in the modal.
- [x] Default behavior remains draft, failed, and stale only.
- [x] When enabled, completed segments from the selected segment forward are made eligible for regeneration.
- [x] Queued and processing segments are not duplicated.
- [x] Focused regression tests pass.
- [x] Production build passes and `engui-studio.service` is restarted.

## Rollback

Revert the implementation commit, rebuild the app, and restart `engui-studio.service`.

## Result

The Generate from selected modal now includes a checkbox for regenerating all non-active segments from the selected segment forward. When enabled, completed segments are included in the modal count/list and the backend marks them stale so the existing generate-from coordinator regenerates them. Queued and processing segments are shown as skipped and are not duplicated.
