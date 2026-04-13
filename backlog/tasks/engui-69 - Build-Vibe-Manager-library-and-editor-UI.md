---
id: ENGUI-69
title: Build Vibe Manager library and editor UI
status: Todo
assignee: []
created_date: '2026-04-13 19:27'
updated_date: '2026-04-13 19:27'
labels:
  - engui
  - vibe-manager
  - ui
  - editor
dependencies:
  - ENGUI-68
priority: high
---

## Description

Build the main Vibe Manager MVP interface as a 2-panel library-plus-editor flow.

Requirements:
- implement left panel library with search, sort, and active/trash toggle
- keep each library row minimal and show only the vibe name
- implement center editor with fields: name, baseDescription, tags, compatibleSceneTypes
- use chip inputs for tags and compatible scene types
- support chip creation via Enter and comma
- normalize chip values to lowercase and dedupe them
- implement explicit Save only, with Save enabled only when the draft is dirty and valid
- implement New, Clone, Delete, and Restore actions per the MVP rules
- make trash mode read-only and hide clone there
- add guarded navigation for dirty drafts except where the spec explicitly allows destructive replacement
