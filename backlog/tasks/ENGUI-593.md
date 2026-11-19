---
id: ENGUI-593
title: Preserve saved image Prompt Helper instructions across desktop remounts
status: Done
assignee: []
created_date: '2026-11-19 15:07'
labels: [desktop, create, bug, persistence]
dependencies: []
---

## Description
Owner14630 reports the browser-saved Prompt Helper instruction repeatedly disappearing in desktop Create Image, unlike mobile.

## Plan
Reproduce a desktop reload with saved Video mode: Image initially mounts, reads the instruction, then empty-state autosave removes it before the parent switches to Video. Replace mount-driven persistence with explicit-edit writes, retaining the existing workspace-scoped key. Share the safe image instruction hook with mobile/tablet without changing their UI or save/cancel semantics.

## Acceptance Criteria

- [x] Reproduce the lost instruction before the fix.
- [x] Mount/hydration/unmount never writes or deletes saved instructions.
- [x] User edits persist immediately; explicit clearing still works.
- [x] Reload, Image/Video switching, reuse remount and workspace isolation preserve the intended value.
- [x] Desktop and mobile focused tests and browser checks pass without live API mutations or paid generations.
- [x] Isolated build, owner commit/push and deployment verified.

## Rollback
Build outside the live .next; preserve the previous build in /home/engui/engui-runs/engui-593-20261119/previous.next before promotion. Restore it and restart engui-studio.service if post-deployment health fails. No server or database changes.

## Root cause and fix
On desktop LeftPanel initially mounts Image, then restores the saved generation mode in an effect. Image's restore effect queued the saved instruction into React state, while its autosave effect immediately deleted the same localStorage key using the initial empty state. Restoring Video unmounted Image before the saved value could be written back. This was reproduced against the deployed production build with fully mocked APIs: storage became null and the Image helper field was empty.

A shared image instruction hook now reads on mount/workspace change and writes synchronously only when its setter is called for an explicit edit. It retains the existing workspace-scoped key, exact nonempty text and intentional clear behavior. Storage events refresh other tabs without echo writes. Desktop and mobile/tablet image flows share the hook; no server, schema, UI copy or generation changes.

## Pre-deployment verification
- Six new desktop regressions: four failed before the fix, all six pass after it.
- Five shared hook regressions and 31 existing desktop/mobile/workspace checks: 42 passing checks total. The 11 new checks were rerun after correcting a test-only TypeScript selector option.
- Isolated production build YTUU4IfzSxH-boErSaF_U passed.
- Chromium and WebKit: 13 checks each, including saved Video reload, edit/remount, shortcut payload, reuse remount, workspaces, multiple tabs, intentional clearing and mobile Save/Cancel/reload. All APIs intercepted; no real jobs or live record mutations.
- Browser fixture corrections (legacy-import marker filtering and complete video-project data) are retained in private evidence; final runs have zero page errors.
- Repository-wide tsc has existing errors, including unchanged generation-result typing. New hook/tests diagnostics checked separately; build succeeds under the existing project configuration.
- Evidence: workspace runs/engui-593-20261119/.

## Deployment verification
- Fix d64e000 authored/committed as Artem Ovechkin, pushed via owner itzing to main.
- Deployed 2026-11-19 15:17:17 UTC, build YTUU4IfzSxH-boErSaF_U. Service active; root and mobile Create/Gallery/Jobs HTTP 200; Tailscale HTTPS HTTP 200.
- Production browser suite: 13 Chromium + 13 WebKit checks pass, zero page errors or unexpected API writes. Screenshots retained and desktop saved-instruction display reviewed.
- Previous build ieMUljEFnNzZxkfYiDPdY retained in /home/engui/engui-runs/engui-593-20261119/previous.next. Isolated preview stopped after verification.
- Full tsc still reports pre-existing project errors; no diagnostics in the new hook or new tests after the selector correction. No physical iPhone test claimed.
