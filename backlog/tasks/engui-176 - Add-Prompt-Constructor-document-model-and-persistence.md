---
id: ENGUI-176
title: Add Prompt Constructor document model and persistence
status: Inbox
assignee: []
created_date: '2026-04-23 18:52'
labels:
  - backend
  - spec
dependencies: [ENGUI-25, ENGUI-68, ENGUI-100]
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the persistence model for the new desktop-first Prompt Constructor defined in `docs/prompt-constructor-single-character-v1-spec.md`. This should introduce a durable PromptDocument record for `single_character_scene_v1`, including template id/version, structured template state, enabled constraint ids, title, timestamps, and normalization helpers. The rendered prompt must remain a derived artifact rather than the persisted source of truth. This ticket establishes the storage contract and server-side types, but not the full desktop UI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A PromptDocument persistence shape exists for template-based prompt documents with template id, template version, title, structured state, enabled constraint ids, and timestamps
- [ ] #2 Persistence helpers normalize and validate stored state for `single_character_scene_v1`
- [ ] #3 The stored record does not rely on a manually edited rendered prompt snapshot as the source of truth
- [ ] #4 The persistence contract is documented and aligned with `docs/prompt-constructor-single-character-v1-spec.md`
<!-- AC:END -->
