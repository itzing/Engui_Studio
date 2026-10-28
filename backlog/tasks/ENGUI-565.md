---
id: ENGUI-565
title: Keep the mobile app shell anchored after keyboard dismissal
status: Done
assignee: []
created_date: '2026-10-28 21:49'
labels: [mobile, frontend]
dependencies: []
---

## Description

Fix the iPhone mobile shell remaining shifted upward after keyboard dismissal, leaving a blank strip under the bottom navigation until the user drags the page. Scope is /m only; retain inner screen scrolling, safe areas, tablet behavior, and desktop document behavior.

## Acceptance Criteria

- [x] Lock only the mobile document root against scrolling/overscroll; keep screen scroll containers usable.
- [x] Synchronize shell height and offset with the visual viewport, including keyboard resize/pan, dismissal, page restore and orientation changes.
- [x] Recover residual root scroll after keyboard dismissal without resetting inner list positions or blurring inputs.
- [x] Remove listeners, scheduled work, root classes and CSS variables on mobile exit; preserve desktop behavior.
- [x] Validate simulated keyboard/viewport sequences, inner scrolling, route transitions, orientation and regression coverage.
- [x] Build production, deploy, and commit/push under the owner identity. No generation jobs.

## Plan

See docs/mobile-keyboard-viewport-fix.md.

## Result

Mobile-only document scroll locking and a fixed visual-viewport shell now prevent the outer page from drifting. Keyboard resize/pan, delayed dismissal, dismissal without blur, route removal of the focused editor, orientation and page restoration are handled. The bottom bar cannot flex-shrink; existing safe-area padding remains. Nested scrollers and desktop styles are preserved, and mobile state/listeners/timers are cleaned up on exit.

Validation: 34/34 focused tests; targeted TypeScript check for the viewport module; production build; 11/11 Chromium fixture checks against the preview and again against the deployed service. The former normal-flow layout reproduced an 80px gap under a synthetic root scroll; the fixed shell rejected the same drift. Final browser runs had zero page errors and zero API writes. Physical iPhone keyboard behavior remains to be confirmed on-device; no claim of a native iOS test.

Service restarted at 2026-10-28 22:10:13 UTC. HTTP /, /m/create, /m/jobs and /m/gallery returned 200. No generation jobs were submitted for validation. Build logs: /home/engui/engui-runs/engui-565-20261028/. Browser reports and screenshots: OpenClaw workspace runs/engui-mobile-keyboard-20261028/.

## Reverted after owner regression report

The owner reported that mobile no longer opened after deployment of 0f445de. ENGUI-566 reverts the entire runtime/test change. The successful Chromium fixture checks did not establish native iPhone correctness. The original keyboard gap remains unresolved; do not treat this fix as shipped. See docs/mobile-viewport-regression-rollback.md.

## Replacement implementation

ENGUI-567 provides a different, bounded keyboard-dismissal recovery while preserving the owner-confirmed shell from d7c1630. The original 0f445de controller remains reverted. See docs/mobile-keyboard-dismissal-recovery.md for design and evidence. Native-device dismissal confirmation is still required after the replacement deployment.
