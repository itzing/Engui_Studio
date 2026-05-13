---
id: ENGUI-326
title: Double Prompt Helper max tokens
status: Done
created: 2026-05-13
---

## Goal

Reduce Prompt Helper truncation errors by doubling the local Prompt Helper `max_tokens` limit.

## Context

Observed error:

```text
Prompt Helper response was truncated by max_tokens before completing valid JSON
```

## Requirement

- Increase Prompt Helper local provider `max_tokens` from `4000` to `8000`.
- Keep the change scoped to Prompt Helper, not Vision Prompt Helper or unrelated extraction routes.
