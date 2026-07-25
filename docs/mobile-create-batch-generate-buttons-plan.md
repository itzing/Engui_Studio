# Mobile Create Batch Generate Buttons Plan

## Context

The mobile `/m/create` image flow currently has one large Generate button. The user wants this split into `Gen 1`, `Gen 3`, and `Gen 6` buttons on one row, where each button starts the corresponding number of runs.

Engui does not currently need a new background task mechanism for this. Once a normal `/api/generate` request succeeds, the resulting RunPod job is already tracked as a regular background job by the existing Jobs flow.

## Decision

Implement the first version as a client-side sequential batch submit on the mobile image Create state.

## Behavior

1. Add `submitBatch(count)` alongside the existing single `submit()` helper.
2. Use `submitBatch(1)` for `Gen 1` so all three buttons share the same code path.
3. Sync a selected prompt draft once before the loop.
4. For every run, generate a new explicit seed and pass a copied `parameterValues` object with that seed.
5. Pass `randomizeSeed: false` for the individual requests so the server stores and resolves against the exact seed chosen by the batch.
6. Submit jobs sequentially, not in parallel.
7. Add each successful job to the existing Jobs state.
8. Stop on the first failure and show a partial-start error.
9. After the batch, update the visible seed to a fresh next seed.

## Why Not a Backend Worker Yet

A backend batch endpoint or worker would be more durable, but it would also introduce batch state, progress storage, cancellation semantics, retry policy, and failure recovery. For 1/3/6 launches, sequential submits over the existing path are simpler and keep every generated run as a normal job.

## Validation

- Focused hook tests for sequential batch submit and unique seeds.
- Focused mobile component tests for three equal batch buttons and disabled/loading behavior.
- Targeted lint for touched files.
- `git diff --check`.
- Prisma validation.
- Production build and service restart after commit.
