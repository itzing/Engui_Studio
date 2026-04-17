---
id: ENGUI-111
title: Add character image trait extraction to Character Manager
status: Inbox
assignee: []
created_date: '2026-04-17 18:12'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add image-based character extraction to Character Manager using the existing vision helper stack, but with a character-specific structured prompt focused on persistent visible character traits.

Scope:
- add `POST /api/characters/extract`
- accept `imageUrl` or `imageDataUrl`
- use the configured vision helper model
- return structured character extraction JSON
- add Character Manager UI flow to upload/paste an image, run extraction, preview the result, and create a new character preset from it

Extraction goals:
- build the most complete visible character profile possible
- focus on persistent visual traits, not scene/environment
- do not invent hidden or unclear details
- prefer omission over hallucination

Structured output:
- `name?: string`
- `gender?: string`
- `summary: string`
- `traits: Record<string, string>`
- `confidence: low|medium|high`
- `warnings: string[]`

Allowed trait keys are restricted to the current character schema keys.

Rules:
- ignore environment and framing unless needed for visibility notes
- treat makeup, styling, lighting, and pose separately from natural traits
- do not guess hidden lower-body traits from portrait crops
- return warnings when parts are occluded or unclear

Out of scope for v1:
- merge into existing character
- multi-image extraction
- per-trait confidence
- crop tools
- extraction history

Acceptance criteria:
- user can extract from image inside Character Manager
- preview shows summary, traits, warnings, confidence
- user can create a new character preset from extracted data
- unknown trait keys are discarded
- invalid model output is handled safely
- no fallback that fabricates a full profile from unclear input
<!-- SECTION:DESCRIPTION:END -->
