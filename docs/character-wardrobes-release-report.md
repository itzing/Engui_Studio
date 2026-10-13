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
Completed at 2026-10-13 07:54 UTC. Runtime revisions: `7cf844a` and `de200bd`; previous production revision: `83c42e3`.

- No active jobs at cutover. The service was stopped before taking a fresh SQLite backup.
- Backup: `/home/engui/backups/wardrobe-20261013/database-before.db`; previous production build retained in `next-before` in the same directory. This is a same-disk operational rollback copy, not protection against physical disk loss. No media files were modified by this release.
- Additive migration created six personal Original outfits, linked them and selected them as defaults. Verification against the fresh backup preserved original rows in all 48 tables; rerunning the migration made no changes.
- Production `npm run build` completed successfully as engui. The service restarted explicitly through sudo systemctl and returned healthy scoped Characters/Outfits responses.
- Preserved counts at cutover: 77 characters (six Showdown), 8,816 gallery assets, 88 LoRAs, 16 prompt documents and five existing Studio runs. Six Original outfits were present; foreign-key check was clean. Jobs remained zero.
- Existing prompt documents and historical previews/versions were not rewritten.
- Deployment log and exit code: `/var/tmp/engui-wardrobe-20261013/deploy.log` and `deploy.exit` (0).

## Authorized follow-up: Showdown Editorial preparation
After rollout the user requested photo sessions for all six characters in their default costumes and fitting locations, using the Editorial pose set. Prepared through the scoped production API, without launching generation:

- Gambler: Velvet Casino.
- Protector: Civic Security Checkpoint.
- Bureaucrat: Ministry Atrium.
- Cheater: Neon Backstreet.
- Rebel: Industrial Rooftop.
- Inventor: Precision Workshop.

Each session uses Character default (Original) and has one draft run with five unassigned slots from Editorial Dynamic, Krea2 Turbo, eight steps, CFG 1, random seed and text-only poses. Runs freeze the resolved identity and default outfit; session briefs retain the live default selection for future runs. Editorial photography is photorealistic on location. Helmet concealment, Inventor's empty left socket/separate right-hand tool, and Gambler's warm golden blonde hair are explicitly preserved.

The existing Cheater Basic session was left unchanged. No new Characters or Outfits were created by this preparation. All six runs remain draft; there are no queued/running jobs. The local audit manifest is `/var/tmp/engui-wardrobe-20261013/showdown-editorials.json`.
