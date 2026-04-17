---
id: ENGUI-107
title: Add scene manager API and template assembly endpoints
status: Inbox
assignee: []
created_date: '2026-04-17 17:04'
labels: []
dependencies: [ENGUI-106]
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the backend API surface for Scene Manager, including scene list/create/update/trash/restore routes and a deterministic template-based scene assembly endpoint. The assembly flow must accept linked pose, character, and vibe inputs plus scene-level instructions and return a stable generatedScenePrompt without using an LLM in MVP. It should preserve slot order, validate pose character-count compatibility, resolve character prompt blocks from existing character data, and return warnings when linked inputs are incomplete or broken. This ticket explicitly establishes template-first assembly so Scene Manager can be QAed before any later AI-powered prompt-polish path is introduced.
<!-- SECTION:DESCRIPTION:END -->
