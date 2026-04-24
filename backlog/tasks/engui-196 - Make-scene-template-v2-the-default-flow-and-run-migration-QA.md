---
id: ENGUI-196
title: Make scene_template_v2 the default flow and run migration QA
status: Done
assignee: []
created_date: '2026-04-24 16:51'
labels:
  - frontend
  - backend
  - qa
dependencies: [ENGUI-190, ENGUI-191, ENGUI-192, ENGUI-193, ENGUI-194, ENGUI-195]
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make `scene_template_v2` the default Prompt Constructor creation flow, keep legacy `single_character_scene_v1` documents loadable during migration, and run QA across save/load, preview, scene duplication, multi-character editing, job snapshot reuse, and gallery snapshot reuse. This ticket should also close out remaining single-character-only terminology or behavior that would make the redesigned Prompt Constructor feel half-migrated.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 New Prompt Constructor scenes default to `scene_template_v2`
- [x] #2 Existing legacy `single_character_scene_v1` documents remain loadable during migration
- [x] #3 QA covers save/load, scene search, preview, multi-character editing, job snapshot reuse, and gallery snapshot reuse
- [x] #4 User-facing Prompt Constructor wording is scene-oriented wherever the redesign requires it
- [x] #5 The redesigned flow does not regress mobile Prompt Constructor behavior
<!-- AC:END -->
