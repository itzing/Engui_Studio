---
id: ENGUI-594
title: Desktop Gallery Select with drag ranges and bulk actions
status: Done
assignee: []
created_date: '2026-11-20 23:31'
labels: [desktop, gallery, ux]
dependencies: []
---

## Description
Owner14637 requests iPhone Photos-like Select mode on desktop: drag through many gallery items, then favorite or delete the selection.

## Plan
Add explicit Select mode to the full desktop Gallery. Click toggles; drag selects a continuous ordered range with edge autoscroll. Dragging from a selected item deselects; reversing contracts the current gesture; Shift-click extends. Preserve IDs across virtualized rows and load intervening pages before actions. Scope selection to the workspace/filter. Use existing favorite/trash endpoints with explicit desired state, four concurrent requests, one aggregate outcome and retained failed IDs. Trash remains reversible; no permanent deletion, API/schema or mobile UI changes.

## Acceptance
- [x] Pointer range, reverse, deselect, additive gestures, Shift and keyboard selection.
- [x] Autoscroll, virtualization, pending pages, scope changes and Escape.
- [x] Mixed favorite states and partial failures; prevent repeated submissions.
- [x] Focused tests and intercepted Chromium/WebKit browser checks.
- [x] Isolated build, owner commit/push, deployment and health verified.

## Rollback
Preserve live .next in /home/engui/engui-runs/engui-594-20261120/previous.next; restore and restart engui-studio.service if verification fails.

## Validation
30 focused tests pass. 16 Chromium +16 WebKit workflow checks pass with all API responses/mutations intercepted. Verified continuous selection across >80 items, virtualization/autoscroll, reverse/deselect gestures, Shift/keyboard, bulk explicit-state favorites, partial failure/retry, Trash restore, filters/workspaces and Escape. Existing Escape test fixture updated to mock ToastProvider. Production build passed; full tsc retains pre-existing project errors, no new feature diagnostics. Private run evidence: runs/engui-594-20261120/.

## Deployment
Feature 78e53a2 pushed as owner itzing. Build yMUdZFD7JfTihpZIJaE1C deployed; service active, local root/mobile Create/Gallery/Jobs HTTP 200 and Tailscale HTTPS 200. Production intercepted browser validation passed 16 Chromium +16 WebKit checks, zero page errors/unexpected writes. Previous build YTUU4IfzSxH-boErSaF_U retained in the task run directory for rollback. Preview stopped. No live assets mutated during validation.
