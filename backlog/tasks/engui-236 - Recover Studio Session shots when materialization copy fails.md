# ENGUI-236 - Recover Studio Session shots when materialization copy fails

## Summary
Studio Session jobs can complete successfully while shot status stays `running` and no shot version appears, because completed-job materialization tries to mkdir/copy into `public/generations/studio-sessions/...` and fails with EACCES.

## Tasks
- Make Studio Session completed-job materialization resilient to local copy/mkdir permission failures.
- Fall back to original job output URL when copy into Studio Session namespace cannot be created.
- Add recovery/reconciliation for already-completed Studio Session jobs so stuck `running`/`queued` shots can transition and surface artifacts.
- Validate with build/tests and deploy.
