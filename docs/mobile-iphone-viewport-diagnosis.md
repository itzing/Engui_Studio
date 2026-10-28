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
