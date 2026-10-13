# Wardrobes and model selection — release verification

Date: 2026-10-13. Branch: feat/wardrobe-models. Specification and implementation plan were written before feature changes and tracked as ENGUI-550 through ENGUI-557.

## Implemented
- Workspace-scoped shared/personal outfits, wardrobe links and defaults; original physical traits separated from Showdown costumes with historical source preserved.
- Z-Image/Krea2 Turbo selection for character previews, Studio runs/settings, and pose-library previews. Krea2 uses pose text only; incompatible LoRAs are blocked.
- Default/selected/custom outfits; explicit neutral-anatomy previews; concealed-face-safe prompts.
- Per-submission look/model preview history; immutable Studio identity/outfit snapshots; per-slot Prompts outfit application and shared composition for Scenes/random characters/copy.
- Atomic, marker-based pose-library initialization; stable workspace-bound fetch callbacks; mobile layout and preview-scroll fixes.

## Evidence
Run directory: `/var/tmp/engui-wardrobe-20261013` (local operational logs, not application content).
- `preservation.log`: original rows verified in all 48 pre-migration tables; six Original outfits; no lost custom trait; all historical CharacterVersions retained; repeat migration is a no-op; foreign-key check passes.
- `integration.log`: workspace isolation, personal/shared restrictions, replacement semantics, explicit anatomy mode, concurrent seeding, non-resurrection of deleted categories, frozen run snapshots, model defaults, LoRA rejection, isolated preview completion/failure, archive handling, and workspace cascade cleanup pass. Remote fetch is deliberately forbidden in this check.
- `tests2.log`: 41 tests pass across six focused suites (including four mocked preview submission cases).
- `seed-regression.log`: the affected existing free-pose test passes after updating its Prisma fixture for the seed marker read.
- Production build passes in the isolated checkout.
- Local Playwright verifies Characters at 390px and 1440px, shared-outfit creation, model/outfit selectors, all preview slots reachable, no horizontal overflow and no browser exceptions. Studio at 390px verifies session outfit save, Krea2 run selection, hidden ControlNet, and persisted model change to Z-Image. Only disposable local data is mutated; no provider generation is launched.

## Baseline limitations
The unchanged base commit already fails 14 cases in three older suites (Characters route/component and Studio server mocks predating workspace isolation). This is confirmed by executing them against an archive of the base revision. They are not reported as passing. Standalone TypeScript validation also has pre-existing errors; comparison finds no new source diagnostics (one Prisma field-order wording difference only). The repository already skips TypeScript and ESLint failures during Next production builds; this change does not alter that setting.

OpenClaw MCP browser/memory tools are not available in this session. Browser checks use the installed local Playwright runtime, not MCP. No MemPalace write is claimed.

## Production rollout
Pending final cutover. Before stopping writers, verify no active jobs. Capture a fresh SQLite backup and retain the previous production build, then fast-forward main, apply the additive SQL/data migration, verify against the fresh backup, generate Prisma and run the production build as engui. Restart explicitly with sudo systemctl. Restore the matching previous code, database and build if any pre-opening check fails.
