---
id: engui-136
title: Define route-based mobile PWA architecture with desktop parity guard
status: open
priority: high
labels: [mobile, pwa, architecture, routing]
created_at: 2026-04-20
updated_at: 2026-04-20
assignee: openclaw
---

## Summary

Define the route-based mobile PWA architecture for Engui Studio under `/m/*`, including explicit rules that protect the current desktop UX from visual or structural regression.

## Desired outcome

The project has an approved architectural plan for a separate mobile route tree that shares business logic with desktop where appropriate but keeps desktop layout and UX unchanged.

## Acceptance criteria

- [ ] The mobile route tree under `/m/*` is defined in a dedicated plan doc
- [ ] Desktop protection rules are explicitly documented
- [ ] Delivery phases, risks, and rollback strategy are documented
- [ ] The implementation order is documented clearly enough to break into execution tickets
