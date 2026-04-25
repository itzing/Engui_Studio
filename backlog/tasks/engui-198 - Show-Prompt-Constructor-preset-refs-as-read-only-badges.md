---
id: ENGUI-198
title: Show Prompt Constructor preset refs as read-only badges
status: Done
assignee: []
created_date: '2026-04-25 13:22'
labels:
  - frontend
  - bug
  - ux
dependencies: [ENGUI-197]
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix the Prompt Constructor character-slot editor so `presetRef` and `posePresetRef` are not rendered as editable text inputs. These fields are internal source references for the applied Character and Pose presets and should appear only as read-only indicator badges or labels. The editable pose content should remain in the normal `pose` field.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Character preset ref is shown as a read-only indicator, not a text input
- [x] #2 Pose preset ref is shown as a read-only indicator, not a text input
- [x] #3 The normal `pose` field remains editable for prompt content
- [x] #4 Regression coverage verifies refs are displayed read-only
<!-- AC:END -->
