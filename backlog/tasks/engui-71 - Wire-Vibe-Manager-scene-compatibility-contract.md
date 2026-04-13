---
id: ENGUI-71
title: Wire Vibe Manager scene compatibility contract
status: Todo
assignee: []
created_date: '2026-04-13 19:27'
updated_date: '2026-04-13 19:27'
labels:
  - engui
  - vibe-manager
  - scene-manager
  - contract
dependencies:
  - ENGUI-68
priority: medium
---

## Description

Define and implement the contract surface that later scene-aware vibe selection will use.

Requirements:
- preserve `compatibleSceneTypes` as user-visible, user-editable advisory metadata on vibe presets
- treat compatible scene types as structured hints for later LLM matching, not as a strict Vibe Manager UI filter
- expose compatible scene type data cleanly through the Vibe Manager read APIs
- avoid baking scene-manager-specific runtime behavior into Vibe Manager itself
- document the intended handoff: Scene Manager will later request compatibility analysis and mark compatible vibes visually without blocking the selector UI
- keep actual scene-side ranking, caching, and async compatibility UX out of this ticket unless needed for a minimal contract stub
