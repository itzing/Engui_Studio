---
id: engui-131
title: Add queueing_up status before RunPod job id is attached
status: done
priority: high
labels: [jobs, runpod, reliability]
created_at: 2026-04-19
updated_at: 2026-04-19
assignee: openclaw
---

## Summary

Fresh RunPod jobs can currently be picked up by the server-side supervisor before `runpodJobId` has been written back to the Engui job row. The supervisor then marks the job failed with `RunPod job id is missing on the Engui job record`, even though RunPod submission may complete successfully a moment later.

## Desired outcome

Introduce a pre-submit local status `queueing_up` and only move jobs to `queued` after the RunPod job id has been received and persisted.

## Acceptance criteria

- [x] New RunPod jobs created by Engui start in `queueing_up`
- [x] RunPod jobs transition to `queued` only after `runpodJobId` is stored
- [x] The supervisor does not immediately fail fresh `queueing_up` jobs that do not yet have `runpodJobId`
- [x] UI treats `queueing_up` as a running state, not a failed state
- [x] Build passes and the service is restarted
