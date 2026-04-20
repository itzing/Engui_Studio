---
id: engui-140
title: Build mobile fullscreen prompt screen
status: done
priority: high
labels: [mobile, create, prompt, keyboard]
created_at: 2026-04-20
updated_at: 2026-04-20
completed_at: 2026-04-20
assignee: openclaw
---

## Summary

Move prompt editing into its own dedicated mobile route so keyboard-heavy prompt work no longer happens inside the main phone Create screen.

## Desired outcome

Prompt editing on phone becomes a fullscreen route-first experience that is robust in iPhone PWA mode.

## Acceptance criteria

- [x] `/m/create/prompt` exists as a dedicated mobile route
- [x] Prompt editing happens on a fullscreen mobile screen
- [x] Prompt changes persist back into the shared mobile draft state
- [x] The main `/m/create` screen stays compact and summary-oriented
- [x] Desktop prompt editing remains unchanged

## Completion notes

Completed with `MobilePromptScreen` under `/m/create/prompt`. Prompt editing now happens on a dedicated mobile route with a fullscreen textarea, persistent shared draft state, and access to the saved Prompt Helper instruction flow. The main `/m/create` route remains compact and summary-based.
