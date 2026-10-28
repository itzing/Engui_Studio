---
id: ENGUI-564
title: Use a non-billable RunPod health check for connection testing
status: Done
assignee: []
created_date: '2026-10-28 20:10'
labels: [backend, api]
dependencies: []
---

## Description

Replace the incorrect RunPod settings connection probe with the queue-based Serverless GET /health operation. Scope is the existing shared backend route, with no desktop/mobile UI changes, generation submissions, or GraphQL balance migration.

## Acceptance Criteria

- [x] Use only GET https://api.runpod.ai/v2/{endpointId}/health with Bearer authorization, no caching, and a bounded timeout.
- [x] Report connectivity success when the health request succeeds, including zero active workers.
- [x] Preserve response metadata and return English authentication, permission, endpoint, rate-limit, HTTP, timeout, and network failures without depending on JSON error bodies.
- [x] Remove the unused RunPod connection helper that can submit a job.
- [x] Verify the route using mocked upstream requests with no live generation jobs.
- [x] Commit and push under the owner identity, build production, restart and verify the service.

## Plan

See docs/runpod-connection-health-check.md.

## Result

The shared RunPod settings test now sends only an authenticated GET to the queue-based Serverless health endpoint. It accepts idle endpoints, uses a ten-second timeout, preserves elapsed time and upstream status, and returns English failures without echoing upstream bodies or exception details. The unused job-submitting connection helper was removed. Other provider checks and the balance route are unchanged.

Validation: 18/18 focused route tests, git diff --check, and production build passed. Service restarted on 2026-10-28 at 20:18:28 UTC. Live Krea2 Turbo health verification through the deployed route returned HTTP 200 / upstream 200 in 433 ms; no generation job was submitted. Root and mobile gallery returned HTTP 200; missing credentials returned HTTP 400.

Release logs and final commit/push record: /home/engui/engui-runs/engui-564-20261028/.
