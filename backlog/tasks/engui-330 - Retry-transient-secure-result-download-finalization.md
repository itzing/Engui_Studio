---
id: ENGUI-330
title: Retry transient secure result download finalization
status: In Progress
assignee: []
created_date: '2026-06-12 09:58'
labels:
  - runpod
  - secure-transport
  - finalization
dependencies:
  - ENGUI-18
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Completed RunPod jobs can fail inside Engui finalization when the freshly written secure result object returns a transient S3 `HeadObject 403 Forbidden` during `aws s3 cp`. Engui currently treats that first download failure as terminal even though the same object can become readable shortly afterward.
<!-- SECTION:DESCRIPTION:END -->

## Scope

- Secure RunPod result finalization in the supervisor.
- Recovery sweep for jobs already marked failed after a completed transport result.
- Regression coverage for transient secure result download failures.

## Acceptance Criteria

- [x] Secure result downloads retry transient S3/HeadObject/Forbidden failures with backoff before failing the job.
- [x] Failed jobs with a completed secure transport result get a bounded recovery attempt instead of staying permanently failed.
- [x] Secure state records enough result metadata to support recovery after supervisor restart.
- [x] Regression tests cover retrying a transient finalization download failure.
- [x] Production build passes and the Engui service is restarted successfully.

## Implementation Notes

<!-- SECTION:IMPLEMENTATION-NOTES:BEGIN -->
Implemented bounded retry/backoff around secure result download/decrypt finalization for transient S3 `HeadObject`/403/404/AWS CLI errors. The supervisor now persists full `result_media` metadata in `secureState.activeAttempt.response.resultMedia` for future recovery, and runs a bounded failed-finalization recovery sweep for jobs whose secure transport result was completed but Engui finalization failed. Older failed records that lack the saved media envelope are marked unrecoverable instead of re-querying expired RunPod job status. Added regression coverage for transient download retry and failed-job recovery.
<!-- SECTION:IMPLEMENTATION-NOTES:END -->
