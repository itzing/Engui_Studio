---
id: ENGUI-181
title: Add Prompt Constructor library tab and block provider adapters
status: Inbox
assignee: []
created_date: '2026-04-23 18:52'
labels:
  - frontend
dependencies: [ENGUI-179, ENGUI-180]
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the Library tab for Prompt Constructor and wire it to reusable prompt-block providers based on existing Character, Vibe, and Pose data. The library should filter by active slot, surface compatible reusable blocks, and let the user replace or append slot content without ever writing directly into the rendered prompt. For the MVP, pose results must stay limited to single-character presets, vibe content can remain reusable freeform fragments, and character-derived blocks should be built from stable trait groups rather than dumping every raw trait.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The Library tab can load reusable blocks derived from Character, Vibe, and Pose sources
- [ ] #2 Library results are filtered by the active slot or compatible block categories
- [ ] #3 Users can replace or append slot content from library items without bypassing structured state
- [ ] #4 Pose-derived library results for this template are restricted to single-character-compatible presets
<!-- AC:END -->
