# ENGUI-454 - Add mobile Create batch generate buttons

Status: Done
Created: 2026-07-25

## Goal

On the mobile Create image surface, replace the single bottom Generate button with three equal-width actions:

- Gen 1
- Gen 3
- Gen 6

Each action should submit the matching number of normal generation jobs through the existing `/api/generate` flow.

## Scope

- Mobile `/m/create` image flow only.
- Reuse the existing image submit path.
- Submit batch jobs sequentially.
- Generate a fresh explicit seed per run.
- Do not add a backend worker or batch queue in this iteration.
- Do not launch real generation jobs during validation.

## Acceptance Criteria

- `Gen 1`, `Gen 3`, and `Gen 6` are displayed in one row with equal widths.
- `Gen 3` and `Gen 6` create independent jobs sequentially.
- Each job receives a unique explicit seed.
- Prompt draft syncing happens once per batch.
- The batch stops on the first failed submit and reports how many jobs were started.
- Focused tests cover the mobile buttons and batch seed behavior.

## Result

Implemented on 2026-07-25.

- Mobile `/m/create` now shows equal-width `Gen 1`, `Gen 3`, and `Gen 6` actions.
- `Gen 1` preserves the existing single-submit Random/Fixed seed behavior.
- `Gen 3` and `Gen 6` sequentially submit normal generation jobs with unique explicit seeds.
- Selected prompt drafts are synced once before the batch loop.
- Batch submit stops on the first failed submit and reports partial progress.
