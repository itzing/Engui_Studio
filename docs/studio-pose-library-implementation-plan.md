# Studio Pose Library Implementation Plan

## Status

Implementation plan for `docs/studio-pose-library-spec.md`.

Backlog tickets must be created after this plan is reviewed and approved.

## Goal

Implement a desktop-only global Pose Library in F-Studio with category/Pose Set management, pose management, structure-only import/export, preview generation/candidate management, and safe integration with existing Studio shot materialization.

## Guiding constraints

- Do not redesign run creation UX.
- Do not add mobile UI in this slice.
- Keep library records mutable, but materialize pose data into shots at use time.
- Use hard deletion for library categories/poses and their preview assets.
- Use the existing common generation/jobs pipeline for preview generation.
- Keep implementation incremental: data foundation first, then APIs, then UI, then preview jobs, then import/export and polish.

## Current likely touchpoints

Expected areas to inspect/modify during implementation:

- `prisma/schema.prisma`
- `src/lib/studio-sessions/poseLibrary.ts`
- `src/lib/studio-sessions/types.ts`
- `src/lib/studio-sessions/portfolioServer.ts`
- `src/components/studio-sessions/*`
- `src/app/studio-sessions/*`
- `src/app/api/studio/*`
- existing job/materialization helpers for generation outputs
- tests around Studio Sessions utilities and API routes

Exact file names may change after code inspection.

## Phase 1 — Data model and library domain foundation

### Objective

Move Pose Library from static/source-like data toward workspace-scoped persisted library entities that can support editing, ordering, deletion, import/export, and preview assets.

### Work

1. Add Prisma models for persisted pose library data:
   - `StudioPoseCategory`
   - `StudioPose`
   - `StudioPosePreviewCandidate`
   - optionally `StudioPoseLibrarySettings`

2. Category model should support:
   - workspace relation
   - name
   - description
   - technical slug/id
   - manual order
   - optional cover pose/candidate reference
   - timestamps

3. Pose model should support:
   - workspace relation
   - category relation
   - title
   - technical slug/id
   - tags JSON
   - pose prompt
   - orientation
   - framing
   - camera angle
   - shot distance
   - manual order within category
   - timestamps

4. Preview candidate model should support:
   - pose relation
   - asset URL/path
   - whether it is primary or primary candidate reference from pose
   - generation job linkage where possible
   - metadata JSON for prompt/settings used
   - timestamps

5. Library settings should support global preview subject/settings:
   - neutral subject description
   - clothing description
   - background/style preset
   - any renderer settings required for preview prompt assembly

6. Update library domain types and serializers.

7. Add helpers for:
   - listing categories with pose counts and missing-preview counts;
   - listing poses by category/all poses;
   - creating/updating/deleting/reordering categories;
   - creating/updating/deleting/duplicating/reordering poses;
   - preview candidate primary selection and deletion;
   - deleting preview assets for a pose/category.

8. Decide migration path for the current static pose library:
   - preferred: one-time seed/import from existing normalized library into the persisted tables;
   - fallback: read static library only for initial import command/API and then persist future changes.

### Validation

- `npx prisma validate`
- `npx prisma generate`
- targeted unit tests for library normalization/serializers
- migration/db push only after backup in local deployment flow

### Risks

- Current code may assume static category arrays. Adapter functions may be needed while UI/API moves to DB-backed categories.
- Preview asset cleanup must not accidentally delete shot result assets.

## Phase 2 — Shot materialization and existing pose-source integration

### Objective

Ensure existing Studio shot/rerun behavior remains functional after library poses are edited/deleted.

### Work

1. Inspect current shot/revision schema and prompt assembly.
2. Identify where pose data is currently stored on shot/revision records.
3. Add/extend snapshot fields if needed so a shot stores:
   - pose title/label at time of use;
   - pose prompt;
   - orientation;
   - framing;
   - camera angle;
   - shot distance;
   - category/Pose Set label if useful for display.

4. Update shot creation to copy pose data from the library into the snapshot.
5. Update rerun/review logic to use the snapshot, not the live library record.
6. Update replace/reshuffle source list to exclude deleted records automatically because hard-deleted records no longer exist.
7. Keep existing run creation UX intact.

### Validation

- tests for snapshot creation from pose library entries
- tests that rerun prompt assembly works without a live library pose
- tests that replacing/reshuffling only lists current library poses

### Risks

- If current runs store only pose IDs, deletion could break historical views. Add display fallbacks before enabling hard delete.
- Avoid introducing new run settings UI while touching this path.

## Phase 3 — API routes

### Objective

Expose a clean internal API for the desktop Pose Library UI.

### Candidate routes

- `GET /api/studio/pose-library/categories`
- `POST /api/studio/pose-library/categories`
- `PATCH /api/studio/pose-library/categories/:categoryId`
- `DELETE /api/studio/pose-library/categories/:categoryId`
- `POST /api/studio/pose-library/categories/reorder`

- `GET /api/studio/pose-library/poses`
- `POST /api/studio/pose-library/poses`
- `GET /api/studio/pose-library/poses/:poseId`
- `PATCH /api/studio/pose-library/poses/:poseId`
- `DELETE /api/studio/pose-library/poses/:poseId`
- `POST /api/studio/pose-library/poses/:poseId/duplicate`
- `POST /api/studio/pose-library/poses/reorder`

- `GET /api/studio/pose-library/settings`
- `PATCH /api/studio/pose-library/settings`

- `POST /api/studio/pose-library/poses/:poseId/previews/generate`
- `POST /api/studio/pose-library/previews/bulk-generate`
- `POST /api/studio/pose-library/previews/:candidateId/set-primary`
- `DELETE /api/studio/pose-library/previews/:candidateId`

- `GET /api/studio/pose-library/export`
- `POST /api/studio/pose-library/import/preview`
- `POST /api/studio/pose-library/import`

Route shape can be adjusted to match current project conventions.

### API requirements

- All routes must be workspace-scoped.
- Hard deletes must delete associated preview assets/candidates.
- Replace-all import must require explicit destructive confirmation payload.
- Bulk generation must return a batch/job summary, not silently enqueue unbounded work.
- Import preview must return summary before applying changes.

### Validation

- route tests for CRUD, reorder, import preview/apply, delete cleanup, and snapshot-safe behavior where practical
- permission/workspace scoping tests if existing harness supports it

## Phase 4 — F-Studio navigation and route shell

### Objective

Add Pose Library as a top-level desktop F-Studio section.

### Work

1. Add `Pose Library` item to the left navigation at the same level as `Portfolios`.
2. Add route pages for:
   - library home;
   - all poses;
   - category detail;
   - pose detail.
3. Add breadcrumbs:
   - `Pose Library`
   - `Pose Library / All poses`
   - `Pose Library / {Category name}`
   - `Pose Library / {Category name} / {Pose name}`
4. Keep desktop-only assumptions consistent with current F-Studio shell.

### Validation

- `npm run build`
- smoke check route HTTP 200s
- ensure sidebar collapse state still behaves correctly

## Phase 5 — Category and pose management UI

### Objective

Implement the main library browsing and CRUD surface.

### Work

1. Library home:
   - category grid;
   - first `+ New category` tile;
   - category tile cover/count/missing count;
   - category tile delete-only hover action;
   - auto/manual cover behavior display.

2. All poses:
   - pose grid;
   - first `+ New pose` tile;
   - missing-preview placeholder;
   - pose delete/duplicate hover actions.

3. Category detail:
   - pose grid scoped to category;
   - first `+ New pose` tile;
   - pose reorder;
   - category edit via local toolbar.

4. Pose detail:
   - metadata display;
   - edit modal/side panel;
   - delete;
   - duplicate;
   - preview block placeholder until preview generation phase is wired.

5. Add hard-delete confirmation flows.

6. Add drag-and-drop reorder with immediate save and failure rollback.
7. Add fallback `Move up/down` actions.

### Validation

- component/unit tests where project patterns exist
- manual smoke via HTTP route render checks
- `npm run build`

### Risks

- Drag-and-drop can add complexity. Prefer a small existing dependency only if already present; otherwise implement minimal desktop pointer reorder or ship fallback first, then DnD.

## Phase 6 — Local Library toolbar, search, filters, and settings

### Objective

Add the contextual local slide-out toolbar inside the central main panel.

### Work

1. Implement local slide-out panel scoped to the Pose Library canvas.
2. Add in-panel open/close button inside the main panel.
3. Ensure it does not conflict with the global Jobs panel and both can be open.
4. Library/all-poses context tools:
   - search;
   - filters;
   - import/export full library;
   - bulk generate missing previews;
   - preview settings.
5. Category context tools:
   - search within category;
   - filters;
   - import/export category;
   - edit category;
   - bulk generate missing previews in category;
   - preview settings.
6. Implement filters:
   - title/prompt/tags text search;
   - category for all poses;
   - orientation;
   - framing;
   - camera angle;
   - has preview/missing preview.
7. Implement global preview subject/settings edit form.

### Validation

- build
- smoke routes
- basic test for filter query helpers if separated

## Phase 7 — Preview generation and candidate management

### Objective

Wire pose preview generation to the existing generation/jobs pipeline and attach outputs as candidates.

### Work

1. Implement preview prompt assembly from:
   - global preview subject/settings;
   - neutral studio/style preset;
   - pose prompt;
   - orientation;
   - framing;
   - camera angle;
   - shot distance.

2. Add single-pose preview generation endpoint:
   - variant count `1/2/4/8`;
   - default `4`;
   - no manual override prompt.

3. Add bulk preview generation endpoint:
   - library scope;
   - category scope;
   - missing previews only;
   - explicit confirmation count;
   - queued/concurrency-limited behavior through common jobs pipeline.

4. Add job materialization hook for pose-preview jobs:
   - successful outputs become preview candidates;
   - candidate metadata stores prompt/settings snapshot;
   - errors remain visible in Jobs.

5. Add pose detail preview UI:
   - primary preview;
   - candidate grid;
   - generate variants;
   - set primary;
   - delete candidate;
   - lightbox compare.

6. Ensure candidate deletion removes the underlying preview asset.
7. Ensure editing semantic pose fields deletes all candidates/assets immediately.

### Validation

- unit tests for prompt assembly
- route tests for candidate set-primary/delete
- materialization test with mocked job outputs
- do not manually launch paid/live generation jobs unless explicitly approved by user

### Risks

- Existing job pipeline may not have a clean metadata channel for pose-preview materialization. If not, add a minimal job-purpose metadata field and materializer.
- Asset deletion must be scoped to pose preview assets only.

## Phase 8 — Import/export

### Objective

Implement structure-only JSON import/export for full library and category scopes.

### Work

1. Define import/export JSON schema.
2. Add visible schema/example panel before import.
3. Export full library structure without preview assets.
4. Export single category structure without preview assets.
5. Import preview endpoint:
   - validates JSON;
   - detects duplicates/conflicts;
   - summarizes new categories/poses and auto-renames;
   - computes destructive effects for replace-all.
6. Import apply endpoint:
   - `Merge` full library;
   - `Replace all` full library;
   - `Merge` into category;
   - `Replace all` selected category.
7. Replace-all deletes replaced library records and preview assets, but not materialized shots.
8. Imported poses are usable immediately and show `Missing preview` until previews are generated.

### Validation

- schema validation tests
- merge conflict auto-slug tests
- replace-all cleanup tests
- export round-trip structure tests

## Phase 9 — QA, deployment, and cleanup

### Objective

Validate the full feature and deploy safely.

### Work

1. Run targeted tests for:
   - pose library domain helpers;
   - Studio shot snapshot/rerun behavior;
   - API routes;
   - prompt assembly;
   - import/export.
2. Run production build.
3. Backup SQLite database before applying schema changes in deployed environment.
4. Apply Prisma DB changes.
5. Restart `engui-studio.service`.
6. Smoke check:
   - `/studio-sessions`;
   - `/studio-sessions/pose-library`;
   - representative API routes.
7. Commit and push changes using the user's git identity.

### Standard validation commands

Use the project-specific commands that are valid at implementation time. Expected baseline:

```bash
npx prisma validate
npx prisma generate
npm test -- tests/lib/studio-sessions-utils.test.ts
npm run build
```

Add new targeted tests for the implemented library routes/helpers.

## Suggested implementation slices

These slices are intended to map cleanly into backlog tickets later.

1. Persisted pose library schema and domain types.
2. Seed/migration path from current static pose categories.
3. Shot pose snapshot hardening.
4. Pose Library CRUD/reorder APIs.
5. Pose Library left-nav route shell and breadcrumbs.
6. Category grid and category CRUD UI.
7. Pose grid/detail CRUD, duplicate, move, reorder UI.
8. Local Library toolbar with search/filter/settings.
9. Preview prompt assembly and single-pose preview jobs.
10. Preview candidate UI, primary selection, deletion, lightbox.
11. Bulk missing-preview generation with confirmation and queue control.
12. Structure-only import/export with merge/replace-all.
13. Delete cleanup and destructive confirmation polish.
14. Final QA/build/deploy pass.

## Rollback strategy

Because this feature introduces schema and persisted library records, rollback should be handled in layers:

1. UI rollback: hide/remove `Pose Library` nav entry and routes if the feature is not ready.
2. API rollback: leave unused routes harmless if no UI links to them.
3. Data rollback: keep new tables even if UI is disabled; avoid destructive down migrations in production unless absolutely necessary.
4. Asset rollback: preview assets are independent from shot assets and can be cleaned if the feature is abandoned.
5. Full DB rollback: before applying schema changes in deployed SQLite, create a timestamped backup under `prisma/db/backups/`.

## Open technical checks before ticketing

Before writing final tickets, inspect the codebase for:

- exact current pose library data shape and where it is consumed;
- whether existing shot records already snapshot pose prompt/frame data;
- current job metadata/materialization extension points;
- existing asset deletion helpers;
- current route and component naming conventions for F-Studio;
- whether a drag-and-drop dependency already exists.

These checks can adjust ticket wording, but should not change the product scope without user approval.
