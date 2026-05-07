# engui-201.3 - Add character preview state model and durable handler

## Summary
Persist per-slot character preview state and implement a backend materialization handler that attaches completed job outputs to the correct character preview slot.

## Scope
- Add `previewStateJson` or equivalent durable preview state to `Character`.
- Extend character serializers/types to expose preview state and a primary portrait thumbnail.
- Add `character_preview` materialization handler.
- Add `POST /api/characters/[id]/preview` backend route.

## Acceptance Criteria
- Characters persist portrait, upper-body, and full-body preview state.
- Completed preview jobs are materialized server-side onto the correct slot.
- Character API responses include usable preview fields for consumers.
