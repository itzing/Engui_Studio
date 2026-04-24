---
id: ENGUI-191
title: Build dynamic character slot editor for scene_template_v2
status: Done
assignee: []
created_date: '2026-04-24 16:46'
labels:
  - frontend
dependencies: [ENGUI-189, ENGUI-190]
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the current desktop Prompt Constructor editor so the scene template can hold a dynamic number of character slots instead of the fixed single-character field set. Users must be able to add, remove, duplicate, reorder, enable, and disable character slots, edit slot labels and roles, assign Character and Pose presets, and manually override the serializable slot fields. The new character-slot section should fit into the existing section-focused desktop shell without regressing save/load behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Users can add, remove, duplicate, reorder, enable, and disable character slots in Prompt Constructor
- [x] #2 Each character slot supports label, role, Character preset reference, Pose preset reference, serializable character fields, and staging fields
- [x] #3 The character-slot editor works with save/load, dirty-state, duplication, and preview flows
- [x] #4 The current desktop Prompt Constructor shell remains usable when scenes contain more than one character slot
<!-- AC:END -->
