---
id: engui-136
title: Define route-based mobile PWA architecture with desktop parity guard
status: done
priority: high
labels: [mobile, pwa, architecture, routing]
created_at: 2026-04-20
updated_at: 2026-04-20
completed_at: 2026-04-20
assignee: openclaw
---

## Summary

Define the route-based mobile PWA architecture for Engui Studio under `/m/*`, including explicit rules that protect the current desktop UX from visual or structural regression.

## Desired outcome

The project has an approved architectural plan for a separate mobile route tree that shares business logic with desktop where appropriate but keeps desktop layout and UX unchanged.

## Acceptance criteria

- [x] The mobile route tree under `/m/*` is defined in a dedicated plan doc
- [x] Desktop protection rules are explicitly documented
- [x] Delivery phases, risks, and rollback strategy are documented
- [x] The implementation order is documented clearly enough to break into execution tickets

## Completion notes

Completed via `docs/engui-mobile-route-based-pwa-plan.md`, which defines `/m/*` as the isolated mobile route tree, preserves the current desktop layout under `/`, stages rollout by milestone, and delays PWA `start_url` switching until the mobile route tree is validated.
