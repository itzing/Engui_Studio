---
id: ENGUI-177
title: Add Prompt Constructor template registry, renderer, and validation engine
status: Inbox
assignee: []
created_date: '2026-04-23 18:52'
labels:
  - backend
  - spec
dependencies: [ENGUI-176]
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the template-capable core for Prompt Constructor v1 so the feature is not hardcoded to one ad hoc form. Introduce the template registry, slot and section definitions, `single_character_scene_v1` initial state factory, deterministic prompt renderer, normalization helpers, and lightweight validation warnings. The engine must keep structured slot state as the only source of truth and render the final z-image turbo prompt in a stable section order without any manual prompt editing path.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A template registry exists even though v1 exposes only `single_character_scene_v1`
- [ ] #2 `single_character_scene_v1` defines its sections, slots, initial state, renderer, and validator in one coherent module
- [ ] #3 Prompt rendering omits empty fragments cleanly, normalizes punctuation, and keeps constraints last
- [ ] #4 Validation returns non-blocking warnings for incomplete or obviously weak prompt documents
<!-- AC:END -->
