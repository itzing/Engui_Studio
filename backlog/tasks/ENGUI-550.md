# ENGUI-550 - Data model and lossless Showdown migration

Status: Done
Created: 2026-10-13
Labels: [wardrobe, characters, studio, desktop, mobile]

## Summary
Add workspace-owned outfits, wardrobe links, preview variants and a repeatable six-character migration.

## Acceptance Criteria
- [x] Implement the corresponding section of docs/character-wardrobes-model-selection-plan.md.
- [x] Verify workspace isolation and preserve existing content.
- [x] Validate without paid generation jobs.

## Verification
- Focused tests, copied-database integration checks, and migration preservation verification passed.
- Browser flows verified at 390px and 1440px; no paid jobs submitted.
