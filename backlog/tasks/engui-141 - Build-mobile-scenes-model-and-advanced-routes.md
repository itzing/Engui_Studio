---
id: engui-141
title: Build mobile scenes, model, and advanced routes
status: open
priority: high
labels: [mobile, create, routing, settings]
created_at: 2026-04-20
updated_at: 2026-04-20
assignee: openclaw
---

## Summary

Split scene selection, model selection, and advanced settings into dedicated mobile routes so the main Create screen stays short and keyboard-safe.

## Desired outcome

Mobile Create becomes a route-based workflow instead of a single overloaded form page.

## Acceptance criteria

- [ ] `/m/create/scenes` exists and supports scene selection/application
- [ ] `/m/create/model` exists for model selection
- [ ] `/m/create/advanced` exists for advanced parameters
- [ ] These screens integrate with shared draft state
- [ ] The main `/m/create` screen remains compact
