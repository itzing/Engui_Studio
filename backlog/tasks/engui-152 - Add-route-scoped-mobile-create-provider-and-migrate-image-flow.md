---
id: engui-152
title: Add route-scoped mobile create provider and migrate image flow
status: planned
priority: high
labels: [mobile, create, frontend, pwa]
created_at: 2026-04-20
updated_at: 2026-04-20
assignee: openclaw
---

## Summary
Mount a single provider under `/m/create/*` and migrate the mobile image-create screens to consume shared live state instead of instantiating isolated `useImageCreateState()` copies.

## Desired outcome
All mobile image-create screens read and write one live draft owner across the route tree, so navigation between model, prompt, advanced, and scenes screens no longer creates competing state instances.

## Dependencies
- ENGUI-151
- `backlog/specs/unified-create-state-implementation.md`

## Scope
- Add `src/app/m/create/layout.tsx`.
- Add `MobileCreateProvider` and `useMobileCreate`.
- Migrate `/m/create`, `/m/create/model`, `/m/create/prompt`, `/m/create/advanced`, and `/m/create/scenes` to the provider.
- Remove screen-level ownership of image draft hydration and persistence.
- Keep existing mobile UX intact unless migration requires targeted UI adjustments.

## Acceptance criteria
- [ ] `/m/create/*` mounts one shared provider for create state
- [ ] Mobile image-create screens no longer own isolated persistence logic independently
- [ ] Navigating across mobile image-create subroutes preserves live state without rehydration races
- [ ] Returning from model, prompt, advanced, or scenes screens does not lose current draft edits
- [ ] Existing image submit behavior still works after the provider migration
