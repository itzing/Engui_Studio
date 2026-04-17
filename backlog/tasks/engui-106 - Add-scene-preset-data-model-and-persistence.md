---
id: ENGUI-106
title: Add scene preset data model and persistence
status: Inbox
assignee: []
created_date: '2026-04-17 17:04'
labels: []
dependencies: [ENGUI-26, ENGUI-68, ENGUI-100]
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the ScenePreset persistence model for the new desktop-first Scene Manager. This should introduce the database schema, migrations, server-side types, normalization helpers, and persistence contract for reusable scenes composed from linked pose, character, and vibe presets. The model must support one to three character slots with stable ordering, optional role labels and slot override instructions, optional linked pose and vibe preset ids, sceneInstructions, generatedScenePrompt snapshot, latest preview metadata, and active/trash status. This ticket should establish the durable scene data shape but not the full desktop UI.
<!-- SECTION:DESCRIPTION:END -->
