---
id: ENGUI-189
title: Add scene_template_v2 state, renderer, validation, and snapshot serializer
status: Done
assignee: []
created_date: '2026-04-24 16:44'
labels:
  - frontend
  - backend
  - spec
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Introduce a new `scene_template_v2` template inside Prompt Constructor so the feature can move from the current single-character-only prompt model to a reusable scene-template model. Define the typed scene state, deterministic block renderer, validation warnings, and immutable scene snapshot serializer described in `docs/prompt-constructor-scene-template-v2-spec.md`. Keep the rendered prompt as a derived artifact and ensure the serialized snapshot is plain JSON that can later be attached to jobs and gallery items.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A typed `scene_template_v2` state model exists for scene summary, dynamic character slots, character relations, composition, environment, style, and constraints
- [x] #2 Prompt Constructor can deterministically render a prompt from `scene_template_v2` using the fixed semantic block order from the spec
- [x] #3 Validation warnings exist for structurally thin scenes, missing relations in multi-character scenes, broken slot references, and other spec-defined soft failures
- [x] #4 An immutable plain-JSON `SceneSnapshot` serializer exists and captures template id, schema version, source scene identity when available, the rendered prompt, warnings, and full scene state
- [x] #5 Existing `single_character_scene_v1` support remains intact while the new template is introduced
<!-- AC:END -->
