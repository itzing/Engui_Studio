# RunPod transient finalization retry plan

## Goal

If RunPod reports a job as completed but Engui cannot download/decrypt the result because RunPod S3 temporarily returns `502 Bad Gateway`, the local job should keep retrying instead of becoming terminal `failed`.

## Product Behavior

- Completed RunPod transport plus transient finalization/download failure leaves the job in `finalizing`.
- The processor records retry metadata and backs off between attempts.
- A later processor tick retries finalization from the completed transport result.
- After the existing recovery retry limit is exhausted, the job may become `failed`.
- Real RunPod `FAILED` statuses still become local failed jobs.

## Implementation

1. Expand transient finalization detection to include `502`, `Bad Gateway`, `503`, `504`, timeout, connection reset, and temporary-unavailable messages.
2. On retryable secure finalization failure, persist `status: finalizing`, clear local `error`, and store `finalizationRecovery` metadata in `secureState`.
3. Defer processor work until `nextAttemptAt` for finalizing retries.
4. Keep the existing failed-finalization recovery path for older jobs already marked failed.
