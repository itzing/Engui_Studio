# Active Job Resolved Video Prompt Metadata Plan

## Context

Active Wan 2.2 video jobs can have `videoPrompt` in `job.options` without `resolvedVideoPrompt`. This hides the `Resolved video` tab in Job Details before the result is saved to Gallery and makes it hard to verify prompt wildcard behavior while the job is still running.

## Plan

1. Persist `resolvedVideoPrompt` for every video job during `/api/generate`, using the resolved server-side prompt value.
2. Include `videoPrompt` and `resolvedVideoPrompt` in optimistic client-side video job state so freshly queued jobs display the same metadata before a list refresh.
3. Treat explicit `resolvedVideoPrompt` as a resolved prompt version even when it equals the original text.
4. Show a fallback `Resolved video` tab for older explicit video prompt metadata that lacks `resolvedVideoPrompt`.
5. Add focused regression tests for server persistence, optimistic client metadata, and prompt normalization.

## Rollback

Revert the Engui commit, run `npm run build`, and restart `engui-studio.service`.
