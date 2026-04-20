---
id: engui-139
title: Build mobile create home screen
status: done
priority: high
labels: [mobile, create, pwa, ui]
created_at: 2026-04-20
updated_at: 2026-04-20
completed_at: 2026-04-20
assignee: openclaw
---

## Summary

Build a dedicated `/m/create` screen that acts as a compact mobile create dashboard instead of reusing the current long desktop-oriented form as the main phone experience.

## Desired outcome

Phone users land on a short, structured mobile Create screen with summaries and entry points into focused editing flows.

## Acceptance criteria

- [x] `/m/create` exists as a standalone mobile screen
- [x] The screen shows compact sections for model, prompt, scene, input image, and key parameters
- [x] The screen does not render the current desktop-style giant inline form as its main UX
- [x] Generate action is available through shared create logic
- [x] Desktop Create experience remains unchanged

## Completion notes

Completed by replacing the temporary `/m/create` wrapper with `MobileCreateHome`, a compact dashboard-style mobile Create screen that links to focused routes for prompt, model, scenes, and advanced settings. The screen now uses shared image-create state plus the extracted shared submit pipeline, and it supports direct mobile image selection plus generation without mounting the desktop `LeftPanel` form as the main phone UX.
