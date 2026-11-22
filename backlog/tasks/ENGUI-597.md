---
id: ENGUI-597
title: Remove orphaned Fairy Tale Z-Image job at owner request
status: Done
created_date: '2026-11-22 19:29'
labels: [jobs, operations]
---

## Request and diagnosis
Owner requested removal of the seven-day-old Z-Image spinner in Fairy Tale. Its Nov 14 submission has no provider job ID, local status submission_unknown and MCP variant submission_unknown. Batch cancellation was already requested, but provider acceptance cannot be confirmed or remotely cancelled without an ID.

## Resolution
- Backed up the exact job, MCP variant and batch privately outside the repository (engui-runs/engui-596-20261122/fairy-orphan-before.json, mode 0600).
- In one scoped transaction marked the single MCP variant failed with OWNER_ABANDONED_SUBMISSION_UNKNOWN and the visible job failed. Kept the existing batch cancellation and historical submission evidence, cleared the expired dispatch lease.
- Removed the visible job through deleteFinishedJob after preservation guards; no generated files existed or were deleted. No paid call, retry, resubmission or claim of provider-confirmed cancellation.
- Verified absent from live workspace Jobs API; six other completed jobs remain unchanged.
- Diagnostic snapshot permits targeted restoration if needed; no whole-database rollback.
