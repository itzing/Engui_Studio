# Resolved Video Prompt Tab Fix Plan

## Context

The details UI builds prompt tabs from normalized prompt versions. New Wan 2.2 video jobs store explicit `videoPrompt` and `resolvedVideoPrompt`, but the shared normalizer only considered `promptTemplate` and `resolvedPrompt`. That can hide the `Resolved video` tab even when resolved video metadata exists.

## Plan

1. Update prompt version normalization to prefer `videoPrompt` for the original video prompt and to read `resolvedVideoPrompt` as a resolved prompt source.
2. Keep gallery API response fields stable by continuing to expose the normalized resolved value as `resolvedPrompt`.
3. Add focused regression coverage for helper normalization, gallery list/detail APIs, and the details prompt switcher.

## Rollback

Revert the Engui commit, run `npm run build`, and restart `engui-studio.service`.
