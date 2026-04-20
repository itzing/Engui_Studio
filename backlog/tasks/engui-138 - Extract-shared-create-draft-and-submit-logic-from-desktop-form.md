---
id: engui-138
title: Extract shared create draft and submit logic from desktop form
status: open
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
- [ ] Shared submit logic is extracted from the current image create flow
- [ ] Scene apply and prompt helper actions are available through reusable hooks or services
- [ ] Desktop UI remains intentionally unchanged
- [ ] Desktop generation behavior is regression-checked after extraction
