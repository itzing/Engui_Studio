# ENGUI-422 - Retry transient RunPod finalization errors

status: done
labels: [backend, runpod, jobs, retry, finalization]

## Goal

Prevent transient RunPod/S3 `502 Bad Gateway` finalization failures from immediately marking a completed RunPod job as locally failed.

## Scope

- Backend RunPod supervisor and job processor.
- Secure transport finalization/download errors after `transport_result.status=completed`.
- Treat transient finalization errors as retryable and keep the local job in `finalizing`.
- Preserve real RunPod execution failures and non-transient finalization failures.
- UI/mobile surfaces are not in scope.

## Validation

- Focused RunPod supervisor tests for transient finalization retry behavior.
- Production build, service restart, and route smoke checks.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify the processor returns to previous finalization failure behavior.

## Result

Implemented for the backend RunPod supervisor. Transient secure finalization/download errors such as RunPod S3 `502 Bad Gateway`, `503`, `504`, timeout, and temporary-unavailable messages now keep the local job in `finalizing` with retry metadata instead of immediately marking it terminal `failed`. The failed-finalization recovery sweep also requeues existing transient failed records without waiting in failed state. Real RunPod execution failures still become local failed jobs.
