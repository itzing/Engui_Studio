---
id: ENGUI-615
title: Owner-controlled MCP model availability and Showdown preferred Vibe
status: In Progress
created_date: '2026-11-25'
labels: [mcp, models, vibes]
---

## Scope
Owner14939 authorizes proposals3/10 only: allow Z-Image and Krea2 Turbo for MCP generation; owner must explicitly approve any further model. Recommend the existing sole Showdown Vibe, without any recommendations in other workspaces. No UI/endpoint changes, automatic Vibe selection, LoRA preferences or paid tests.

## Design
Private operator JSON policy outside Git, read on request/dispatch. Separate owner approval and local configuration from runtime health. Reject unavailable preparation, start and queued dispatch while keeping historical reads/receipts and already accepted provider work intact. Mark only the exact active preferred Vibe with preferred=true in both Vibe list tools and detail; omit the field elsewhere. Keep explicit vibeId and existing immutable snapshots/revision semantics.

## Validation
Isolated MCP SDK tests for policy failures, prepare/start/dispatch fencing, allowed models and no paid submissions; preferences scoped by workspace/ID with trash/restore and no implicit prompt changes. Existing MCP regressions, production candidate HTTP proof, live public Showdown discovery/disabled preparation only.

## Rollback
Retain serving build and previous private policy (or its prior absence). No database migration or Vibe content mutation. Restore previous build/config and restart the service if needed; never restore old database over accepted work.

## Local validation
222 focused/regression tests passed, including19 new operator-policy scenarios. Covers both approved encrypted adapters with fake providers, disabled preparation/replay/start/dispatch/final-provider-boundary checks, unchanged accepted-work receipts/history, invalid policy failure, cross-workspace omission, same-ID trash/restore and explicit-only Vibe composition. Existing adapter tests now use isolated operator files instead of inheriting production configuration. The first two assertions exposed generic worker error mapping; MODEL_UNAVAILABLE/MODEL_POLICY_UNAVAILABLE are now retained and all tests pass. No provider inference.
