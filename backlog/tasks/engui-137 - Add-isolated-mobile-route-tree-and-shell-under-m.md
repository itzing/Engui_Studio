---
id: engui-137
title: Add isolated mobile route tree and shell under /m
status: done
priority: high
labels: [mobile, pwa, routing, shell]
created_at: 2026-04-20
updated_at: 2026-04-20
completed_at: 2026-04-20
assignee: openclaw
---

## Summary

Create a dedicated mobile route tree under `/m/*` with its own app shell and router-based bottom navigation, without changing the current desktop entry or desktop layout composition.

## Desired outcome

Engui has a separate mobile shell that no longer depends on the current stateful mobile tab wrapper and can evolve independently from desktop.

## Acceptance criteria

- [x] `src/app/m/*` route skeleton exists for Create, Preview, Jobs, and Gallery
- [x] A dedicated mobile shell is added for `/m/*`
- [x] Mobile bottom navigation is route-based, not local-tab-state based
- [x] The current desktop `/` experience remains visually unchanged
- [x] The new mobile shell does not use the current `MobileStudioLayout` as its primary implementation base

## Completion notes

Completed with a separate `/m/*` route tree and dedicated mobile shell in `src/components/mobile/*`, plus route pages for Create, Preview, Jobs, and Gallery. The scaffold reuses current panel components for functionality, but navigation is now pathname-based and no longer depends on `MobileStudioLayout` local tab state. Added an event bridge so existing mobile preview and reuse flows still route correctly between isolated mobile pages.
