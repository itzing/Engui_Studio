---
id: engui-140
title: Build mobile fullscreen prompt screen
status: open
priority: high
labels: [mobile, create, prompt, keyboard]
created_at: 2026-04-20
updated_at: 2026-04-20
assignee: openclaw
---

## Summary

Move prompt editing into its own dedicated mobile route so keyboard-heavy prompt work no longer happens inside the main phone Create screen.

## Desired outcome

Prompt editing on phone becomes a fullscreen route-first experience that is robust in iPhone PWA mode.

## Acceptance criteria

- [ ] `/m/create/prompt` exists as a dedicated mobile route
- [ ] Prompt editing happens on a fullscreen mobile screen
- [ ] Prompt changes persist back into the shared mobile draft state
- [ ] The main `/m/create` screen stays compact and summary-oriented
- [ ] Desktop prompt editing remains unchanged
