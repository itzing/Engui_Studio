---
id: ENGUI-576
title: Select and strip Vibes in desktop and mobile Create Image
status: Done
assignee: []
created_date: '2026-10-30 16:40'
labels: [frontend, mobile, generation, vibes]
dependencies: []
---

## Description

Select an existing active Vibe in desktop and mobile Create Image. Prepend its description only at submission. Provide a separate semantic Strip vibe action on the current prompt.

## Acceptance Criteria

- [x] Both surfaces expose a Vibe selector with None and the existing active workspace presets.
- [x] Selection persists with image drafts. Server prepends the selected description exactly once per submission before wildcard/variant expansion and records source metadata for reuse.
- [x] Strip vibe uses the configured text Prompt Helper to remove lighting, atmosphere and emotional tone while preserving literal scene details; failures and stale requests do not overwrite edits.
- [x] Cleaning a linked Prompt Draft produces an editable manual copy without modifying the saved document; Undo restores the previous state.
- [x] Generation, model switching, workspace isolation, batch submission and reuse work without affecting video or Vibes management.
- [x] Focused tests, isolated build, desktop/mobile browser checks, deployment and owner commit/push complete without real generation jobs or paid helper validation.

## Plan

See docs/create-image-vibes.md.

## Completion

132 focused tests pass, including Vibe assembly/reuse, batch forwarding, cleanup validation, stale results, Undo and existing mobile behavior. The isolated production build passes. WebKit and Chromium each passed 16 dedicated desktop/mobile Vibe scenarios and 50 UI regression scenarios in preview and deployed HTTPS. Final preview screenshots confirm readable native select contrast and 320/390px hit targets. Each dedicated browser run simulated five generation submissions, local job persistence and helper responses entirely in memory; no real generation jobs or model-backed cleanup calls were launched. Read-only production checks found six active Vibes and a configured text helper. The deployed strip endpoint rejected an empty prompt with 400 before inference.

Service restarted at 2026-10-30 16:49:42 UTC and serves HTTP 200. Preview exited 0. Previous production build is retained at /home/engui/engui-runs/engui-576-20261030/previous.next. Full repository tsc remains non-clean on both baseline HEAD and candidate; normalized diagnostic comparison found zero added errors. Next production build skips the repository type/lint gate, so this is not a claim of a clean full-project typecheck. Physical iPhone and semantic quality of live LLM cleanup remain owner-side validation.
