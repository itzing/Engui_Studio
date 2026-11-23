# ENGUI-600 — Recover stalled LoRA uploads and make Cancel reachable

## Status
In progress

## Request
Owner14721: Cancel cannot be clicked while a LoRA upload is stuck. Investigation found pointer-events-none on the upload area containing Cancel, no part inactivity timeout, and cancellation waiting on remote cleanup before releasing UI.

## Scope
Shared desktop/mobile LoRA manager only. Keep multipart part size, target binding and existing three-attempt retry limit. Cancel must work during initialization, upload and completion, release UI immediately, and never allow an old upload to change a newer upload state. Stop the remainder of a multi-file selection on cancellation. Add bounded cleanup and stale-part retries; preserve pending cleanup visibility.

## Operational recovery
Owner attempted to cancel snofs_krea_v1_6.safetensors. Scoped abort of pending upload dab77fc0-8ec1-4524-a25b-43ee665fa4cb returned HTTP200, DB status aborted. Only three incomplete 64MiB parts were present. No published LoRA touched.

## Acceptance
- Pointer and keyboard Cancel remain reachable while uploading.
- No-progress part and no-response part both terminate and enter existing bounded retry loop.
- Slow progress is allowed; successful completed parts are not resent.
- Cancellation immediately aborts active requests, releases UI, and stops remaining selected files, independent of cleanup latency.
- Late initialization/completion/cleanup cannot clear or finalize a newer upload.
- Focused tests, browser pointer checks, isolated production build, commit/push and live smoke.

## Rollback
Restore retained previous .next build and restart engui-studio.service; revert feature commit. No schema change. Cancelled unpublished multipart data is intentionally discarded; user must choose original file again.
