# Character Wardrobes and Model Selection — Implementation Plan

Depends on: [specification](character-wardrobes-model-selection-spec.md).

## 1. Data and migration (ENGUI-550)
1. Add workspace-owned Outfit and CharacterOutfit records, one default pointer per character, and immutable CharacterLookPreview variants. Add session outfit selection fields and a pose-seed completion marker.
2. Update workspace ownership inventory, relation validation and deletion inventory; all new queries use scoped Prisma.
3. Write a standalone additive migration/rehearsal tool. Snapshot pre-migration traits, create six deterministic Original outfits, move explicit costume keys only, pin preexisting dynamic Studio snapshots, retain CharacterVersions and source imports.
4. Verify idempotency and unchanged unrelated tables/rows on a SQLite copy. No production data changes in this phase.

## 2. Shared look and model policy (ENGUI-551)
1. Implement pure identity/outfit composition with default/selected/custom/neutral modes, archive and personal-owner checks.
2. Implement supported-model validation, model-specific steps and LoRA compatibility checks. Keep model selection explicit, never automatic fallback.
3. Resolve frozen DTO snapshots for all generating surfaces. Add focused tests for duplicate clothing, permanent prostheses, concealed faces and mutable source data.

## 3. Wardrobe API and UI (ENGUI-552)
1. CRUD workspace shared/personal outfits with archive semantics and explicit personal variants.
2. Character wardrobe assignment/default operations; reject foreign workspace/personal references.
3. Responsive library and character wardrobe UI; load/error/empty states and clear ownership labels. Preserve current editor unsaved-change protections.

## 4. Character previews (ENGUI-553)
1. Model selector and look selector on the existing three preview slots.
2. Resolve look before submission, pass model defaults, report endpoint-paused failures before creating false queued state.
3. Persist look/model/source snapshots as separate variants; route asynchronous materialization/failures to the original variant. Do not overwrite another look when completion arrives late.
4. Preserve legacy preview state and expose saved variants. Test mocked submission and stale completion handling without remote generation.

## 5. Studio (ENGUI-554)
1. Extend session brief with outfit mode/reference/custom text.
2. Freeze identity plus selected outfit in templateSnapshotJson on new run creation. Respect legacy snapshots.
3. Model controls in create-run and run settings; hide ControlNet controls for Krea2, preserve text poses.
4. Filter LoRAs by selected base model; server rejects mismatches. Avoid changing already launched jobs. Add prompt/snapshot regression tests.

## 6. Prompts integration (ENGUI-555)
1. Extend character-slot metadata for outfit selection and resolved source snapshots.
2. Applying a character/look updates only that slot's identity/outfit, not pose, staging or neighboring characters.
3. Keep existing saved text self-contained. Ensure copy/random-character paths use the resolver and do not append stale clothing.

## 7. Pose library (ENGUI-556)
1. Model selection for single/bulk previews; actual model/parameters in snapshots.
2. Atomic workspace seeding with completion marker and retries/recheck; avoid count-before-transaction race and deleted-category resurrection.
3. Test concurrent initialization and repeated reads with edited/deleted categories.

## 8. Validation and cutover (ENGUI-557)
1. Run targeted unit/API/integration tests, TypeScript checks and production build in isolated checkout.
2. Run migration rehearsal on a consistent current database copy, verify counts and exact retained records, repeat for idempotency.
3. Validate responsive pages with available browser tooling or local render tests; do not launch paid jobs.
4. Commit under Artem Ovechkin's identity, push with the itzing account. Make a fresh production backup and record rollback commit/database.
5. Stop production writers, fast-forward code, apply additive schema plus verified data migration, regenerate Prisma, build as engui in a detached logged job, explicitly restart engui-studio.service.
6. Smoke scoped APIs and verify six original outfits, unchanged gallery/LoRAs/prompts, protected Default and service health. On failure restore matching backup/code before reopening writes.
7. Complete backlog, release report and local memory. Report any unavailable external memory/browser tooling honestly.
