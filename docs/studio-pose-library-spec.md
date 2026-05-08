# Studio Pose Library Specification

## Status

Product specification for the desktop-only Studio Pose Library.

This document captures the requirements agreed during the Pose Library requirements grill on 2026-05-08.

Implementation plan and backlog tickets must be created separately after this specification is reviewed.

## Objective

Add a first-class desktop Pose Library to F-Studio so the user can browse, manage, preview, import, export, and curate reusable pose categories and poses from the main Studio workspace.

The library is a global workspace asset library. It is not scoped to a specific portfolio, character, session, or run.

## Product principles

- Desktop-only for v1.
- The library is a main Studio section, not a modal helper.
- A category is a Pose Set.
- Runs are not redesigned by this feature.
- Existing run settings may consume the library as a pose source, but this feature must not introduce new run-selection UX.
- A pose is materialized into a shot when used. Completed shots/reruns must not depend on the mutable library record.
- Library deletion is hard deletion for library records/assets, but existing shots stay functional from their materialized pose snapshot.
- Preview generation is deliberate and user-controlled, not automatic on every import or edit.

## Navigation and placement

### Left navigation

Add a new left-sidebar item:

- `Pose Library`

It appears on the same top-level level as `Portfolios`.

### Routes

Use a dedicated route branch:

- `/studio-sessions/pose-library` — Pose Library home.
- `/studio-sessions/pose-library/all` — all poses view.
- `/studio-sessions/pose-library/categories/:categoryId` — category detail.
- `/studio-sessions/pose-library/categories/:categoryId/poses/:poseId` — pose detail.

IDs/slugs are technical implementation details. They must not be shown in the normal UI.

### Breadcrumbs

Breadcrumbs should follow this shape:

- `Pose Library`
- `Pose Library / All poses`
- `Pose Library / {Category name}`
- `Pose Library / {Category name} / {Pose name}`

Every ancestor breadcrumb should be clickable.

## Core concepts

### Pose category / Pose Set

A category is the primary grouping mechanism and also the Pose Set exposed to Studio flows.

A category has exactly one ordered list of poses. Poses can move between categories.

User-visible category fields:

- `Name`
- `Description`
- `Order`
- `Cover pose` / auto-cover behavior

Technical fields such as IDs/slugs may exist for routes/import/export but must not be shown in the standard UI.

### Pose

A pose belongs to exactly one primary category and can have many tags.

User-visible pose fields:

- `Title`
- `Category`
- `Tags`
- `Pose prompt`
- `Orientation`
- `Framing`
- `Camera angle`
- `Shot distance`
- `Order within category`

Technical IDs/slugs must not be exposed in the normal UI.

### Pose frame-control fields

The pose controls default shot composition through these v1 fields:

- `orientation`: `portrait`, `landscape`, `square`
- `framing`: `full_body`, `three_quarter`, `upper_body`, `portrait`
- `cameraAngle`: `front`, `three_quarter`, `side`, `back`, `high`, `low`
- `shotDistance`: `close`, `medium`, `wide`

These values are defaults from the pose. Existing run/shot settings may override them where such override already exists. This specification does not add new run UX.

## Shot materialization rule

When a library pose is used to create a shot, the shot must store a snapshot of the pose data needed for rerun/review:

- pose title or label at time of use
- pose prompt
- orientation
- framing
- camera angle
- shot distance
- any other prompt/rendering fields required by the current generation pipeline

After this snapshot exists:

- deleting or editing the library pose does not break completed shots;
- rerun from an existing shot remains possible using the snapshot;
- reshuffle/replace must not offer a deleted pose;
- old shots do not retroactively change when the library pose changes.

## Library home

The Pose Library home shows category tiles in the main canvas.

Requirements:

- First tile is `+ New category`, matching the other F-Studio lists.
- Category tiles show:
  - cover image;
  - category name;
  - pose count;
  - missing-preview count;
  - optional last-updated metadata.
- Category tile click opens the category detail page.
- Category tiles support drag-and-drop reorder.
- Category order saves immediately after drag-and-drop.
- If saving order fails, the UI should revert the visual order and show an error.
- Fallback reorder actions (`Move up`, `Move down`) should exist outside drag-and-drop.
- Category tile hover action: `Delete` only.
- Edit/import/export/category settings live inside the category page, not as category tile actions.

## All poses view

The library includes an `All poses` view.

Purpose:

- browse every pose across all categories;
- search/filter globally;
- find duplicates or missing previews;
- edit/delete/duplicate poses without jumping category-by-category.

Requirements:

- First tile is `+ New pose`.
- Poses appear as tiles.
- The local Library toolbar provides global search/filter/import/export/bulk generation actions.

## Category detail page

The category detail page shows the poses in that category.

Requirements:

- First tile is `+ New pose` with category preselected.
- Pose tiles show primary preview or missing-preview placeholder.
- Poses support drag-and-drop reorder within the category.
- Pose order saves immediately after drag-and-drop.
- If saving order fails, revert and show an error.
- Fallback reorder actions (`Move up`, `Move down`) should exist.
- The local Library toolbar is scoped to the current category.
- Category editing, category import/export, and category bulk preview actions live inside this page.

## Pose tiles

Pose tile behavior:

- Clicking the tile opens pose detail.
- Hover actions:
  - `Delete`
  - `Duplicate`
- Do not expose full edit controls on the tile.
- Do not expose primary-preview selection on the tile.

Pose tile with preview:

- Shows primary preview image.
- Shows pose title.
- Shows compact frame metadata such as orientation/framing.
- May show tags if space allows.

Pose tile without preview:

- Shows a designed placeholder, not an empty grey box.
- Shows title.
- Shows category/tag context where useful.
- Shows `orientation / framing` or equivalent frame summary.
- Shows `Missing preview` badge.

## Pose detail page

Pose detail is the main workspace for one pose.

Requirements:

- Show pose metadata and frame-control fields.
- Provide an `Edit` action that opens a modal or side panel.
- Do not inline-edit every field directly on the page.
- Provide `Delete` and `Duplicate` actions.
- Provide preview generation and candidate management as a central visible block, not hidden in the toolbar.
- Provide a lightbox for comparing preview variants at large size.

### Pose editing behavior

If only these metadata fields change, existing preview candidates are kept:

- title
- tags
- category
- order

If any semantic visual field changes, all existing preview candidates/assets for that pose are deleted immediately:

- pose prompt
- orientation
- framing
- camera angle
- shot distance

Rationale: outdated preview images are misleading and should not remain as stale visual references.

## Duplicate pose

A pose can be duplicated.

Requirements:

- Duplicate within current category.
- Duplicate into another category.
- Duplicated pose copies structure and prompt fields.
- Preview assets should not be copied by default unless implementation later proves this is clearly useful.
- The duplicated pose starts with missing preview.

Category duplication is explicitly out of scope for v1.

## Deletion rules

### Pose deletion

Pose deletion is hard deletion of the library pose.

Requirements:

- Delete the library pose record.
- Delete all preview assets/candidates for that pose.
- Do not affect already materialized shots.
- Deleted pose must not appear in future reshuffle/replace/new-run pose selection.

### Category deletion

Category deletion is hard deletion of the category and its library poses.

Requirements:

- Delete the category record.
- Delete all contained library pose records.
- Delete all contained pose preview assets/candidates.
- Do not affect already materialized shots.
- Deleted category must not appear as an available Pose Set for future selection.

Because this is destructive, the UI must use a clear confirmation flow.

## Local Library toolbar

The Pose Library has a contextual local slide-out toolbar.

Important layout requirements:

- It is inside the central main panel, not the global app height.
- Its open button is inside the Pose Library main panel.
- It is separate from the global Jobs panel.
- Jobs panel and Library toolbar can both exist at the same time.
- It should visually behave similarly to the Jobs slide-out pattern, but scoped to the central library canvas.

### Toolbar contexts

On library home / all-library context:

- search
- filters
- import full library
- export full library
- bulk generate missing previews across library
- global preview subject/settings

Inside a category:

- search within category
- filters within category
- import into category
- export category
- edit category
- bulk generate missing previews in category
- global preview subject/settings

On pose detail:

- Keep primary pose actions and preview actions in the page content.
- The toolbar may still expose search/settings if useful, but preview controls must remain central.

## Search and filters

Search/filter is required in v1 for all poses and category views.

Minimum filters:

- text search across title, prompt, tags
- category filter in `All poses`
- orientation
- framing
- camera angle
- has preview / missing preview

Filters should not block using/importing poses without previews.

## Preview system

### Preview purpose

Pose previews are visual aids for browsing and choosing poses. They are not character-specific outputs and must not replace shot results.

### Preview subject

Default preview generation uses a neutral subject, not a Character Manager character.

The library has global preview subject/settings editable in v1.

Examples of settings:

- neutral adult subject description
- simple fitted clothing
- neutral studio background
- studio/photo style preset

Changing global preview settings affects future preview generations only. Existing previews are not deleted, invalidated, or marked stale because of global setting changes.

### Preview prompt assembly

Preview prompts are assembled only from stored library data:

- global preview subject/settings;
- neutral studio/style preset;
- pose prompt;
- orientation;
- framing;
- camera angle;
- shot distance.

No manual one-off override prompt exists in v1.

### Preview candidates

Each pose has:

- zero or one primary preview;
- zero or more preview candidates.

Requirements:

- Generated successful outputs automatically attach to the pose as candidates.
- User can set one candidate as primary preview.
- User can delete any candidate.
- User can use a lightbox to inspect candidates.
- Deleting the primary candidate clears/replaces the primary according to implementation rules, but must not leave a broken tile image.

### Preview generation controls

On pose detail:

- `Generate variants`
- variant count selector: `1`, `2`, `4`, `8`
- default variant count: `4`
- candidate grid
- `Set primary`
- `Delete variant`

### Bulk preview generation

Bulk generation is required for:

- all missing previews in the library;
- missing previews inside a category.

Requirements:

- Must show an explicit confirmation with estimated count before starting.
- Example: `23 poses × 4 variants = 92 images`.
- Must use the common generation/jobs pipeline.
- Must run as a batch with concurrency/queue control.
- Must not silently launch a large number of generation jobs.
- Generated successful outputs attach back to their poses as candidates.

### Jobs integration

Preview generation uses the existing common jobs pipeline and global Jobs panel.

Requirements:

- Preview jobs should appear in Jobs.
- Errors and progress should be visible through the common job surface.
- No separate hidden generation runner should be introduced for preview generation.

## Category covers

Category cover behavior:

- A category cover can be selected from the primary preview of one of its poses.
- If no cover is selected manually, use the first pose in manual order that has a primary preview.
- If no pose has a primary preview, show a category placeholder.

## Import/export

Import/export is required in v1.

### Export

Export contains structure only.

Export must not include:

- preview images;
- preview candidate assets;
- generated job history.

Export scopes:

- full library;
- one category.

### Import

Import scopes:

- full library;
- one category.

Import modes:

- `Merge`
- `Replace all`

No `Update` mode in v1. Matching/updating is intentionally excluded because comparing imported records to existing records is ambiguous.

### Merge behavior

Merge adds imported categories/poses as new records.

If slug/name conflicts occur:

- do not update the existing record;
- create a new technical slug/id automatically;
- show a pre-import summary such as `12 new poses, 3 renamed because of duplicate slugs`.

### Replace all behavior

For full library import:

- replaces the full library structure;
- deletes replaced category/pose records and their preview assets;
- does not affect already materialized shots.

For category import:

- replaces the selected category's pose structure;
- deletes replaced pose records and their preview assets;
- does not affect already materialized shots.

Replace all requires strong confirmation because it is destructive.

### Import schema preview

Before loading/importing, the UI must show a preview/example of the expected JSON structure.

This should be human-readable enough for editing by hand.

Example shape:

```json
{
  "categories": [
    {
      "name": "Standing",
      "description": "Standing poses",
      "poses": [
        {
          "title": "Relaxed contrapposto",
          "tags": ["standing", "relaxed"],
          "orientation": "portrait",
          "framing": "full_body",
          "cameraAngle": "three_quarter",
          "shotDistance": "wide",
          "posePrompt": "The subject stands in a relaxed contrapposto stance..."
        }
      ]
    }
  ]
}
```

Imported poses are immediately usable, even without previews. Missing preview is only a visual/library state, not a readiness blocker.

## Ordering

Ordering requirements:

- Categories have manual order.
- Poses have manual order within a category.
- Fallback sorting should be stable by name/date if order is missing.
- Desktop v1 supports drag-and-drop reorder.
- Fallback move actions must exist.
- Reorder saves immediately and reverts on failure.

## Run integration boundaries

This feature must not redesign run creation or run settings.

Allowed integration:

- expose categories as Pose Sets to existing run flows;
- ensure pose records include the frame-control data needed by existing shot creation;
- ensure library poses are materialized into shot snapshots when used;
- ensure deleted poses/categories are no longer offered for future selection.

Explicitly out of scope:

- new custom pose-set builder for runs;
- new run count/limit controls;
- new run selection flow;
- changing how users configure runs beyond reading the new library source.

## Non-goals for v1

- Mobile UI.
- Character-specific pose previews.
- One-off preview prompt override.
- Category duplication.
- Import update/matching mode.
- Exporting preview assets.
- Dedicated Missing Previews page.
- Skeleton/keypoint editing.
- Pose extraction from reference images.
- Full run workflow redesign.

## Open implementation questions

These are intentionally left for the implementation plan, not the product spec:

- exact Prisma model names;
- preview asset storage location and cleanup helper;
- exact generation job materialization hook for pose previews;
- whether current static pose-library data is migrated into database records or loaded through a one-time import;
- exact drag-and-drop library;
- exact route component split.

## Acceptance criteria

The v1 feature is complete when:

1. `Pose Library` appears in the desktop left nav beside `Portfolios`.
2. `/studio-sessions/pose-library` renders category tiles in the main canvas.
3. Categories can be created, edited, reordered, and hard-deleted.
4. Poses can be created, edited, moved between categories, duplicated, reordered, and hard-deleted.
5. Pose detail supports preview candidate generation, primary selection, candidate deletion, and lightbox comparison.
6. Preview generation uses the common jobs pipeline and attaches successful outputs as candidates.
7. Bulk missing-preview generation exists for full library and category scopes with explicit confirmation.
8. Import/export exists for full library and category scopes, structure-only, with Merge and Replace all modes.
9. Import UI shows the expected JSON structure/example before import.
10. Category tiles show pose count and missing-preview count.
11. Pose tiles render useful placeholders when previews are missing.
12. Existing completed shots/reruns remain functional after deleting library poses/categories because they use materialized pose snapshots.
13. Deleted poses/categories are not offered for future reshuffle/replace/new selections.
14. No mobile implementation is added for this v1 slice.
