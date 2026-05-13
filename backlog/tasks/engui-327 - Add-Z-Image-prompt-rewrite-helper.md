---
id: ENGUI-327
title: Add Z-Image prompt rewrite helper
status: Done
created: 2026-05-13
---

## Goal

Add a dedicated Z button that rewrites tag-style / Pony / SD1.5 prompts into a structured Z-Image prose prompt.

## Requirements

- Show the Z rewrite control only when the selected image model is Z-Image.
- Support desktop Create Image UI.
- Support mobile prompt UI.
- Reuse the configured local Prompt Helper model.
- Use a dedicated system prompt for Z-Image prompt rewriting.
- The model response must be plain text only, not JSON.
- Do not request or update a negative prompt.
- Auto-replace the current prompt after a successful rewrite.
- Preserve the existing prompt if the rewrite fails.

## Result

- Added dedicated plain-text API route `/api/prompt-helper/z-image-rewrite`.
- Added desktop Z button for Z-Image only.
- Added mobile Z rewrite button for Z-Image only.
- Successful rewrite replaces the current prompt and shows `Rewritten for Z-Image`.
