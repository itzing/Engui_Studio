---
id: ENGUI-497
title: Add desktop local model ask dialog
status: Done
created: 2026-08-03
---

## Goal

Add a desktop-only utility window where the user can send one plain request to the configured local text helper model and copy the returned answer.

## Requirements

- Support desktop only.
- Expose the tool from the desktop workspace tools area.
- Reuse the configured local Prompt Helper provider and text helper service.
- Send a single stateless request with no chat history persistence.
- Show one request input and one response output.
- Include a copy-to-clipboard action for the response.
- Provide loading and error states.
- Do not affect existing Prompt Helper prompt-rewrite flows.

## Result

- Added `POST /api/local-model/ask` for one stateless local text-helper request.
- Added desktop `Ask Local Model` dialog with request input, answer output, loading/error states, and copy-to-clipboard action.
- Added `Ask Local Model` to the desktop workspace `Tools` menu.
- Covered the endpoint and dialog with focused tests.
