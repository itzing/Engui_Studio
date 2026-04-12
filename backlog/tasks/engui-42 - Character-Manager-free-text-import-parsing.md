---
id: ENGUI-42
title: Character Manager free-text import parsing
status: In Progress
assignee: []
created_date: '2026-04-12 12:02'
updated_date: '2026-04-12 12:02'
labels:
  - character-manager
  - engui
  - ui
  - import
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend Character Manager import so it supports free descriptive text, not only explicit `key: value` lines.

Requirements:
- Keep current structured `key: value` import working.
- Accept a free-text paragraph like `named vesper, having eastern european ethnicity, pale ivory skin tone, ...`.
- Auto-extract `name`, optional `gender`, and as many known character traits as possible into the existing trait schema.
- Show the parsed preview before confirmation using the extracted values.
- Prefer pragmatic deterministic parsing for the current schema rather than requiring a separate AI call.
- It is acceptable for unsupported phrases to be ignored, but the sample free-text import provided by the user should parse into meaningful trait entries.
<!-- SECTION:DESCRIPTION:END -->
