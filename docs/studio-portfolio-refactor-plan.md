# Studio Portfolio Refactor Plan

## Goal

Refactor Studio Sessions from a template-first batch generator into a portfolio-first workflow for building coherent character image sets.

The new product model should support two different levels of coherence:

1. **Photo Session / Shoot coherence** — one character in one setting with consistent light, location, outfit, and vibe.
2. **Portfolio / Collection coherence** — one character across many different sessions, settings, and contexts.

## Current Problem

The current Studio Session flow is centered around `StudioSessionTemplate` and allows a single run to mix pose categories. In practice this creates batches of unrelated shots that do not feel like a coherent photo session.

Issues:

- A single run can include many pose categories, which makes light/location/vibe tuning difficult.
- `Template` behaves more like a complex run settings draft than a stable reusable product entity.
- There is no top-level character portfolio that can contain multiple coherent sessions for the same character.
- There is no curated collection layer for assembling final sets from multiple sessions/runs.
- The current UI does not clearly distinguish planning, running, reviewing, and final selection.

## Target Conceptual Model

```text
Studio
  Portfolios
    Portfolio
      Character
      Sessions / Shoots
        Session Brief
          setting
          light
          vibe
          outfit
          hairstyle
          notes
        Runs
          Run Settings
          Pose Set
          Generated Images
          Review State
      Collections / Final Sets
        Selected Images from any session/run in this portfolio
```

## Entity Definitions

### Portfolio

A portfolio is the main Studio entry point. It is centered on one character and owns all sessions and collections for that character.

Fields:

- `id`
- `workspaceId`
- `characterId`
- `name`
- `description`
- `status`: `active | archived`
- `createdAt`
- `updatedAt`

Primary UI:

- Studio home shows a list/grid of character portfolios.
- User can create a portfolio from an existing Character Manager character.
- Later, optionally allow creating a new character during portfolio creation.

### Session / Shoot

A session is one coherent shoot inside a portfolio. It should represent one setting and one visual direction.

Fields:

- `id`
- `portfolioId`
- `name`
- `settingText`
- `lightingText`
- `vibeText`
- `outfitText`
- `hairstyleText`
- `negativePrompt`
- `notes`
- `status`: `draft | active | review | completed | archived`
- `createdAt`
- `updatedAt`

Rules:

- A session inherits the portfolio character.
- A session can have many runs.
- Session-level fields are inherited by runs by default.

### Run

A run is one concrete generation attempt inside a session. A run should use exactly one pose set.

Fields:

- `id`
- `sessionId`
- `poseSetId`
- `name`
- `positivePromptOverride`
- `negativePromptOverride`
- `generationSettingsJson`
- `resolutionPolicyJson`
- `count`
- `status`: `draft | queued | running | completed | failed | cancelled`
- `createdAt`
- `updatedAt`

Rules:

- One run = one pose set.
- No mixed category counts inside one run.
- The current template editor should become the run settings panel.
- A run may be duplicated as a new run draft.
- A run may be saved as a reusable run preset.

### Pose Set

A pose set is a curated group of pose snapshots meant to work together.

Examples:

- Standing casual
- Chair portraits
- Sitting floor
- Desk/table
- Walking outdoors
- Close-up portraits
- Full-body reference

Fields:

- `id`
- `name`
- `description`
- `category`
- `poseIdsJson`
- `tagsJson`
- `createdAt`
- `updatedAt`

Initial implementation can derive pose sets from current pose categories, but the UI should present them as sets, not mixed category counts.

### Generated Image / Version

Existing job/result/version data can remain mostly intact, but each generated result should be traceable to:

- portfolio
- session
- run
- pose snapshot
- job

Review state should support:

- `pick`
- `maybe`
- `reject`
- `hero`
- `needs_retry`

### Collection / Final Set

A collection is a curated set of selected images from any sessions/runs in the same portfolio.

Fields:

- `id`
- `portfolioId`
- `name`
- `description`
- `status`: `draft | final | archived`
- `createdAt`
- `updatedAt`

Collection items:

- `id`
- `collectionId`
- `sourceVersionId` or gallery asset reference
- `sessionId`
- `runId`
- `sortOrder`
- `caption`
- `createdAt`

Use cases:

- `Aurora — Everyday Life`
- `Aurora — Best Portraits`
- `Aurora — Portfolio Final 20`

### Run Preset

Run presets are optional reusable settings blobs. They should not be the central workflow.

Fields:

- `id`
- `workspaceId`
- `name`
- `description`
- `generationSettingsJson`
- `resolutionPolicyJson`
- `promptDefaultsJson`
- `createdAt`
- `updatedAt`

Rules:

- User can save current run settings as a preset.
- User can load a preset into a run draft.
- Presets do not own sessions or generated images.

## Current Template Migration Strategy

Current entity:

```text
StudioSessionTemplate
```

Target meaning:

```text
Run settings draft / legacy run preset
```

Recommended migration:

1. Keep existing template tables initially for compatibility.
2. Introduce new Portfolio and Session tables.
3. Add a migration script that converts each existing template into:
   - one Portfolio if needed, grouped by character
   - one Session using template-level environment/outfit/hairstyle/prompt fields
   - one Run Draft using generation settings and category rules
4. For templates with multiple category counts, create one run draft per non-zero category or pose set.
5. Mark old templates as legacy after migration.
6. Remove template-first UI once portfolio/session/run UI is stable.

## UX Plan

### Studio Home

Show portfolios first.

Actions:

- Create portfolio
- Open portfolio
- Archive portfolio

Portfolio card displays:

- character preview image
- character name
- number of sessions
- number of final collection items
- latest activity

### Portfolio Page

Tabs:

1. Sessions
2. Collections
3. Character
4. Presets (optional/later)

### Sessions Tab

Shows session cards.

Session card displays:

- session name
- setting/light/vibe summary
- selected hero image if any
- run count
- picked/maybe/rejected counts

Actions:

- Create session
- Duplicate session
- Archive session
- Open session

### Session Page

Sections:

1. Session Brief
2. Runs
3. Contact Sheet
4. Picks

Session Brief editor:

- setting
- lighting
- vibe
- outfit
- hairstyle
- negative prompt
- notes

Runs area:

- Add run
- Choose one pose set
- Configure model/settings
- Generate
- Duplicate run
- Save as preset

Contact Sheet:

- all generated images from all runs in this session
- filters by run/pose/review state
- quick review actions: Pick / Maybe / Reject / Hero / Retry

### Collections Tab

Collections are curated final sets from any sessions in the portfolio.

Actions:

- Create collection
- Add selected images from session contact sheets
- Reorder images
- Remove images
- Export/add to gallery

## Run Settings Panel

The current template editor should be refactored into a reusable `RunSettingsPanel`.

It should contain:

- pose set selection
- model selection
- generation settings
- LoRA settings
- prompt overrides
- resolution policy
- count

It should not own:

- character selection
- portfolio identity
- session-level brief fields, except inherited preview display

## Pose Selection Change

Replace category count sliders with a single pose set picker.

Old behavior:

```text
standing: 5
sitting: 5
chair: 5
```

New behavior:

```text
poseSetId: chair_portraits
count: 12
```

For MVP, pose set can map to an existing category plus a count. Later it can become a curated explicit list of pose IDs.

## API Plan

New API groups:

```text
/api/studio/portfolios
/api/studio/portfolios/[id]
/api/studio/portfolios/[id]/sessions
/api/studio/sessions/[id]
/api/studio/sessions/[id]/runs
/api/studio/runs/[id]
/api/studio/runs/[id]/launch
/api/studio/runs/[id]/duplicate
/api/studio/runs/[id]/save-preset
/api/studio/collections
/api/studio/collections/[id]
/api/studio/collections/[id]/items
```

Keep existing endpoints until migration is complete.

## Implementation Phases

### Phase 1 — Data model and compatibility layer

- Add Portfolio, Session, Run, Collection, CollectionItem, RunPreset models.
- Keep existing StudioSessionTemplate and run models operational.
- Add server mappers that can expose legacy templates as run drafts if needed.
- Add tests for serialization and migration helpers.

### Phase 2 — Portfolio home

- Replace Studio Sessions landing view with Portfolio list.
- Add portfolio creation from existing character.
- Use existing CharacterSelectModal for character selection.
- Show full-body preferred character preview.

### Phase 3 — Session management

- Add Portfolio detail page.
- Add session list and session brief editor.
- Move character identity to portfolio level.
- Remove character selection from run/session settings except read-only context.

### Phase 4 — Run settings panel

- Extract current template editor into `RunSettingsPanel`.
- Replace category sliders with one pose set picker and count.
- Run launch should create jobs only from the selected pose set.
- Add duplicate run and save/load preset actions.

### Phase 5 — Contact sheet and review flow

- Add session contact sheet across all run results.
- Implement review states: Pick / Maybe / Reject / Hero / Needs retry.
- Add filters by run, pose set, review state.

### Phase 6 — Collections

- Add collection list inside portfolio.
- Add collection detail with ordered selected images.
- Allow adding picks from any session in the portfolio.
- Add export/add-to-gallery path.

### Phase 7 — Legacy cleanup

- Migrate or archive old templates.
- Remove template-first UI.
- Rename remaining code paths away from `StudioSessionTemplate` where practical.

## MVP Cut

The smallest useful MVP:

1. Portfolio list.
2. Portfolio detail with one character.
3. Sessions under portfolio.
4. Session brief editor.
5. Add run with one pose set and count.
6. Generate run.
7. Session contact sheet with Pick/Reject.
8. Collection with manual add from picks.

Defer:

- advanced run preset library
- collection export polish
- explicit curated pose set editor
- migration UI for old templates
- analytics/quality scoring

## Open Questions

1. Should a portfolio allow changing its character after creation, or should that be locked?
2. Should one collection be allowed to mix images from multiple portfolios, or only one portfolio?
3. Should session brief fields be inherited into run prompt at launch time only, or stay live-linked until generation?
4. Should pose sets be user-editable from the first release, or derived from current pose categories initially?
5. Should old templates be migrated automatically or left in a legacy archive screen?

## Recommendation

Build the new system alongside the existing template system first. Do not delete the old template flow until portfolio/session/run creation can generate and review images end-to-end.

The product language should shift from:

```text
Template -> Run
```

to:

```text
Portfolio -> Session -> Run -> Picks -> Collection
```

This matches the real workflow: build a character portfolio, create coherent shoots, run focused pose sets, review results, and assemble final collections.
