# ENGUI-559 - Build deterministic framing-aware look compiler

Status: Done
Created: 2026-10-13
Labels: [characters, wardrobe, framing]

## Scope
Implement region-scoped identity/outfit snapshots, framing visibility and source freshness checks. See docs/framing-aware-looks-spec.md and docs/framing-aware-looks-plan.md.

## Acceptance Criteria
- [x] Portrait excludes lower garments and footwear.
- [x] Visible hands, helmet and permanent anatomy are handled explicitly.
- [x] Stale classifications do not silently override edits.
- [x] Offline compiler regression tests pass.
