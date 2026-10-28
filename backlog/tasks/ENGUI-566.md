---
id: ENGUI-566
title: Restore mobile availability after the viewport regression
status: Done
assignee: []
created_date: '2026-10-28 22:24'
labels: [mobile, frontend, regression]
dependencies: []
---

## Description

The owner reports that mobile no longer opens after deployment of 0f445de (ENGUI-565). Server-side HTTP 200 and Chromium fixture tests did not prove real-device usability. Restore the previously working mobile source without introducing another viewport workaround.

## Acceptance Criteria

- [x] Revert only the runtime and test changes introduced by 0f445de; preserve RunPod health checks and the gallery return point.
- [x] Preserve the failed fix history and explicitly record its rollback.
- [x] Run relevant regression tests and a production build, restart the service, and check mobile routes and client rendering without creating jobs.
- [x] Commit and push under the owner identity; report the real-device validation limit honestly.

## Plan

See docs/mobile-viewport-regression-rollback.md.

## Result

Reverted the full ENGUI-565 runtime/test change; src/ and tests/ exactly match 7e96ba5. The failed fix history is retained, ENGUI-565 is reopened, and the original keyboard gap remains unresolved. No replacement viewport workaround was deployed.

Validation: 39/39 existing mobile, form-factor, gallery-position and RunPod-health tests passed. Production build exited 0; service restarted at 2026-10-28 22:31:53 UTC. Ten HTTP checks passed across loopback and the owner-facing HTTPS site. Thirteen browser checks passed on the deployed HTTPS site (Create, prompt editor, Jobs, Carousel, Gallery, bookmark, reload, phone sizes, tablet/rotation gates and desktop); no page errors, API writes or unexpected API requests in the final run. Chromium used its real viewport API, not the earlier visualViewport mock. Native iPhone recovery remains owner-side confirmation.

The initial browser smoke had an incomplete wildcard API fixture, causing an undefined-map exception; correcting the test response to include wildcards: [] resolved it. Production code was not changed. Original failure artifacts are preserved separately. No jobs were launched.

Evidence: /home/engui/engui-runs/engui-566-20261028/ and OpenClaw workspace runs/engui-mobile-rollback-20261028/.
