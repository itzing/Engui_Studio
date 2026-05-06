# ENGUI-237 - Show live shot job status and run timings

## Summary
Studio Session shots should surface the real underlying job lifecycle instead of a coarse `running` state, and the UI should show per-shot execution time plus total run execution time.

## Tasks
- Expose latest Studio Session job status/details per shot in run detail payload.
- Reconcile shot/run state from latest linked jobs without losing Studio Session review semantics.
- Show current job status on shot cards using the underlying job lifecycle labels.
- Show execution time per completed shot/job.
- Show aggregated total execution time for the run.
- Validate with tests/build and deploy.
