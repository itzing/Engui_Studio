---
id: engui-137
title: Add isolated mobile route tree and shell under /m
status: open
priority: high
labels: [mobile, pwa, routing, shell]
created_at: 2026-04-20
updated_at: 2026-04-20
assignee: openclaw
---

## Summary

Create a dedicated mobile route tree under `/m/*` with its own app shell and router-based bottom navigation, without changing the current desktop entry or desktop layout composition.

## Desired outcome

Engui has a separate mobile shell that no longer depends on the current stateful mobile tab wrapper and can evolve independently from desktop.

## Acceptance criteria

- [ ] `src/app/m/*` route skeleton exists for Create, Preview, Jobs, and Gallery
- [ ] A dedicated mobile shell is added for `/m/*`
- [ ] Mobile bottom navigation is route-based, not local-tab-state based
- [ ] The current desktop `/` experience remains visually unchanged
- [ ] The new mobile shell does not use the current `MobileStudioLayout` as its primary implementation base
