# Real-device mobile viewport diagnosis

## Why measurements are needed

08dec6b preserves app availability but the owner reports it does not fix keyboard-dismissal drift. A screenshot alone cannot distinguish a scrolled document from a stale CSS viewport height or excessive bottom safe-area padding. Do not claim the synthetic tests reproduced the actual device mechanism.

## Temporary capture

Collect only numeric window/screen/visualViewport/document/shell/nav geometry, an enum event/screen, ephemeral random page label and iOS version. Never read input values, prompts, storage, image URLs, queries or identities. No UI controls or layout mutations are added. Samples are rate-limited, capped per page and stored in a size-limited private temporary file; capture has a hard one-hour expiry shared by client and server. The endpoint accepts only sanitized allowlisted data and exposes no read API.

Capture load, focus, resize/scroll and delayed settle frames. Compare the state immediately after dismissal with the state after the owner's normal manual drag correction. Remove temporary capture once measurements identify the cause. Build in isolation and verify WebKit/Chromium before deployment. No generation jobs.

## Completion

This is an investigative stage, not a claim that the panel bug is fixed. Leave ENGUI-568 open until an evidence-backed correction and native verification are complete.

## Capture deployment

Deployed 22:52:53 UTC; hard expiry 2026-10-28T23:50:05.131000+00:00. Private numeric JSONL: /tmp/engui-mobile-viewport-568.jsonl. Client 80 samples/page, 180 ms minimum interval; server allowlist and approximately 256 KiB size cap. Actual on-device samples remain required. No behavior change or claimed fix is included in this stage.

## Actual iPhone evidence and selected correction

61 samples from iOS 18.7 standalone show a 402 x 874 CSS-pixel screen. Before the keyboard, innerHeight/dvh/body/shell/nav-bottom are 874. After dismissal they remain 812, despite zero document scroll and zero visualViewport offset. Navigation padding remains 34 throughout. Manual dragging gradually restores the height to 874; a later drag only restores 838. Root clientHeight remains 812 even in the good state. This is a dynamic viewport sizing problem, not excess navigation padding or simply residual document pan.

Private numeric evidence is retained in /home/engui/engui-runs/engui-568-fix-20261028/device-evidence.jsonl. Remove the collection client and API now that evidence is available.

Options: (1) continue scroll resets, ruled out by zero-scroll broken samples and interference with manual dragging; (2) switch dvh to lvh, but the device capture does not establish lvh correctness; (3) use the measured stable CSS screen size for the installed iPhone shell. Select option 3, scoped to iPhone/iPod standalone only. Regular Safari, Android, iPad and desktop keep their original dynamic viewport sizing.

A body-scoped CSS variable sizes the existing normal-flow shell and orientation gate from screen dimensions with physical orientation, not keyboard viewport height. Preserve safe areas, nested scrolling and input focus; do not fix the body, listen to scrolling, call scrollTo, prevent gestures or run recovery timers. Remove ENGUI-567's ineffective scroll recovery. Clean up the variable and listeners on mobile unmount.

Verification must include the observed 874 -> 812 state with root scroll already zero, initial load in the shortened state, negative manual overscroll, physical rotation and non-PWA exclusion. Synthetic replay is a regression check, not a claim that an actual iPhone keyboard was tested. Native owner confirmation remains outstanding after deployment.

Rollback: retain the live .next during isolated compilation and preserve it as previous.next when deploying. Restore that build and restart the service if availability regresses; retain source history in git.

## Deployment of evidence-backed correction

Service restarted 2026-10-28 23:11:28 UTC with isolated build sTXQs-ZtxJBU57K-4Gfzp. 50 targeted tests and module TypeScript validation pass. Final isolated WebKit and Chromium checks pass 18 scenarios per engine, including explicit old-CSS collapse comparison, captured height replay, initial shortened viewport, phone rotation, regular-browser/tablet/desktop and gallery controls. Physical keyboard behavior still requires owner confirmation.

Removed diagnostic route returns 404. Previous build is retained at /home/engui/engui-runs/engui-568-fix-20261028/previous.next. Preview exited 0. Browser evidence: runs/engui-iphone-height-fix-20261028 (agent workspace). No generation jobs or production API writes were submitted for validation.

Deployed HTTPS verification: WebKit and Chromium each pass 18 checks, with zero JavaScript page errors, unexpected API paths and production API writes. The device-height replay is simulated; actual iPhone dismissal confirmation remains pending.
