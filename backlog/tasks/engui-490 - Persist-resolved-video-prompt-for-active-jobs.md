# ENGUI-490 - Persist resolved video prompt for active jobs

Status: done

## Goal

Ensure active video jobs store and display `resolvedVideoPrompt` in Job Details immediately after submit, including queued and processing jobs.

## Scope

- Video generation submit API
- Optimistic video job state after client submit
- Prompt version normalization for explicit video metadata

## Notes

- `resolvedVideoPrompt` must be written even when the resolved text currently matches `videoPrompt`.
- Details should show the `Resolved video` tab when explicit video resolved metadata exists.
- Older jobs with `videoPrompt` but no `resolvedVideoPrompt` should still show a fallback `Resolved video` tab with the stored video prompt.
- Gallery details will inherit the field when a completed job is saved to the gallery through the existing generation snapshot path.

## Rollback

Revert the Engui commit, run `npm run build`, and restart `engui-studio.service`.

## Result

Implemented in Engui Studio. `/api/generate` now persists `resolvedVideoPrompt` for every video job, including cases where it matches `videoPrompt`. The optimistic video job state also includes `videoPrompt` and `resolvedVideoPrompt` immediately after submit. Prompt normalization shows a `Resolved video` fallback for older jobs that have explicit `videoPrompt` metadata but are missing `resolvedVideoPrompt`.
