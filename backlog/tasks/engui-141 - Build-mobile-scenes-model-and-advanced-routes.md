---
id: engui-141
title: Build mobile scenes, model, and advanced routes
status: done
priority: high
labels: [mobile, create, routing, settings]
created_at: 2026-04-20
updated_at: 2026-04-20
completed_at: 2026-04-20
assignee: openclaw
---

## Summary

Split scene selection, model selection, and advanced settings into dedicated mobile routes so the main Create screen stays short and keyboard-safe.

## Desired outcome

Mobile Create becomes a route-based workflow instead of a single overloaded form page.

## Acceptance criteria

- [x] `/m/create/scenes` exists and supports scene selection/application
- [x] `/m/create/model` exists for model selection
- [x] `/m/create/advanced` exists for advanced parameters
- [x] These screens integrate with shared draft state
- [x] The main `/m/create` screen remains compact

## Completion notes

Completed with dedicated mobile routes for scenes, model selection, and advanced parameters, all backed by the new shared mobile image-create state hook. Scene routes can select and apply prompts or preview images, model selection is route-based, and advanced settings are editable without reopening the desktop-style long form.
