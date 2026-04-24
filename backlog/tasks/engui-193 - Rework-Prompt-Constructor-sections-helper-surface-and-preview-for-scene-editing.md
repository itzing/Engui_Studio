---
id: ENGUI-193
title: Rework Prompt Constructor sections, helper surface, and preview for scene editing
status: Done
assignee: []
created_date: '2026-04-24 16:48'
labels:
  - frontend
dependencies: [ENGUI-189, ENGUI-191, ENGUI-192]
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Rework the current desktop Prompt Constructor section model so it matches the scene-template structure: Scene Summary, Characters, Relations, Composition, Environment, Style, and Constraints. Update the section rail, section-focused editor, helper surface, and preview behavior so they all reflect the new scene-centric authoring flow. The goal is to preserve the current desktop v2 shell where it still helps while replacing the single-character assumptions baked into the current sections.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The desktop Prompt Constructor sections align with the scene-template data model from the spec
- [x] #2 The section rail, focused editor, and helper surface stay coherent when scenes include multiple characters and relations
- [x] #3 The helper surface can show slot-relevant assistance for character, relation, environment, style, and constraints editing
- [x] #4 Preview continues to render the full deterministic prompt, warnings, and scene context from the new scene-template state
- [x] #5 Mobile Prompt Constructor behavior remains unchanged
<!-- AC:END -->
