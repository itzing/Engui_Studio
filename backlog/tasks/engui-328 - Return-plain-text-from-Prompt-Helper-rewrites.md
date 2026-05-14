---
id: ENGUI-328
title: Return plain text from Prompt Helper rewrites
status: Done
created: 2026-05-14
---

## Goal

Make Prompt Helper rewrite flows return the rewritten prompt text directly instead of JSON envelopes.

## Requirements

- The local Prompt Helper model must be instructed to return only the final positive prompt text.
- Do not request JSON from the Prompt Helper model.
- `/api/prompt-helper/improve` should return `text/plain` containing the rewritten prompt on success.
- `/api/prompt-helper/z-image-rewrite` should return `text/plain` containing the rewritten prompt on success.
- Frontend callers should consume plain text responses and preserve existing prompt on failure.
- Negative prompt editing is no longer part of the plain-text Prompt Helper response.
- Support desktop and mobile surfaces that use the shared Prompt Helper client.

## Result

- Prompt Helper local provider now asks for plain final positive prompt text only, without JSON.
- `/api/prompt-helper/improve` returns `text/plain` on success.
- `/api/prompt-helper/z-image-rewrite` returns `text/plain` on success.
- Shared frontend Prompt Helper client consumes plain text responses.
- Production build passed.
