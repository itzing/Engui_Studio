---
id: engui-138
title: Extract shared create draft and submit logic from desktop form
status: in_progress
priority: high
labels: [mobile, desktop, shared-logic, forms]
created_at: 2026-04-20
updated_at: 2026-04-20
assignee: openclaw
---

## Summary

Extract reusable create-flow state and submit logic from the current desktop-oriented forms so the new mobile route tree can reuse logic without reusing the desktop UI composition.

## Desired outcome

Desktop keeps the same UI, while mobile routes can consume shared hooks or services for draft state, prompt handling, scene application, parameter state, and generation submit.

## Acceptance criteria

- [ ] Shared create draft state is extracted from desktop-oriented components
- [x] Shared submit logic is extracted from the current image create flow
- [x] Scene apply and prompt helper actions are available through reusable hooks or services
- [x] Desktop UI remains intentionally unchanged
- [x] Desktop generation behavior is regression-checked after extraction

## Progress notes

Current extraction pass moved shared image-create services into `src/lib/create/*`:
- `imageDraft.ts` for reusable image draft snapshot helpers
- `imagePromptHelper.ts` for prompt-helper and vision-prompt-helper requests
- `imageScenes.ts` for active-scene fetch/apply helpers
- `submitImageGeneration.ts` for shared image submit pipeline

`ImageGenerationForm` now consumes those services while keeping the existing desktop UI intact. Remaining work for full completion is to move more of the live create-state orchestration itself out of the desktop-oriented component so dedicated mobile screens can consume it directly.
