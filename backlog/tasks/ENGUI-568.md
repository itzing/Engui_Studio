---
id: ENGUI-568
title: Diagnose real iPhone keyboard dismissal geometry and fix persistent panel drift
status: In Progress
assignee: []
created_date: '2026-10-28 22:46'
labels: [mobile, frontend, regression]
dependencies: []
---

## Description

Owner reports the ENGUI-567 document-pan recovery is ineffective immediately when the iPhone keyboard closes; no navigation is needed. Native-device geometry is required to distinguish scroll offset, CSS viewport height, visual viewport state and bottom safe-area padding before another behavioral change.

## Acceptance Criteria

- [x] Obtain bounded, temporary geometry-only samples from the affected device; collect no prompts, input values, URLs, media, credentials or user identifiers.
- [x] Diagnose the observed mechanism using before/after keyboard and manual recovery measurements.
- [x] Apply the smallest evidence-backed mobile correction, preserving normal app availability and nested scrolling.
- [ ] Remove temporary collection, test/build/deploy and have the owner verify actual dismissal behavior.

## Plan

See docs/mobile-iphone-viewport-diagnosis.md.

## Diagnostic stage deployed

Temporary numeric-only capture deployed at 22:52:53 UTC; expires at 2026-10-28T23:50:05.131000+00:00. Private capture file: /tmp/engui-mobile-viewport-568.jsonl (mode 0600, maximum approximately 256 KiB). Client is capped at 80 samples per page and a minimum 180 ms sampling interval. No read API, values/prompts/URLs or identities are collected.

56 focused tests and targeted TypeScript check passed. Isolated production build passed. Both WebKit and Chromium preview checks passed 13 scenarios each, including payload-shape assertions with the diagnostic POST mocked. The actual preview and production endpoints accepted a marked numeric-only probe (204); these are not native-device observations. Working layout and existing recovery behavior were not changed in this stage.

Owner has been asked to reopen the PWA, dismiss the keyboard, wait 2–3 seconds and manually drag the panel back. Await actual iPhone samples before changing behavior. This ticket remains In Progress; the panel bug is not claimed fixed.

## Evidence received

Actual iPhone trace isolates 62px dynamic-height loss (874 -> 812) after dismissal with zero root scroll and unchanged 34px nav padding. Implementing standalone iPhone screen-height sizing, removing automatic pan recovery and temporary capture. See plan for constraints, tests and rollback.

## Correction implemented

Installed iPhone/iPod only: preserve full CSS screen height through the keyboard's stale dynamic viewport, using physical orientation. Existing normal-flow shell, safe areas and nested scroll remain. Regular browser, tablet and Android are excluded. Removed the old pan-recovery module and temporary diagnostic collection/endpoint. 50 targeted tests and module TypeScript validation pass. Isolated production build succeeds without replacing the working build during compilation.

Physical iPhone confirmation is still required after deployment; keep this ticket In Progress until the owner confirms the actual dismissal behavior.

## Deployed candidate

Deployed at 23:11:28 UTC; previous build retained for rollback. Isolated WebKit + Chromium: 18 checks each pass. Temporary diagnostic endpoint removed (404). Owner native dismissal confirmation is the remaining acceptance item; synthetic checks alone do not close it.

Deployed HTTPS verification: WebKit and Chromium each pass 18 checks, with zero JavaScript page errors, unexpected API paths and production API writes. The device-height replay is simulated; actual iPhone dismissal confirmation remains pending.
