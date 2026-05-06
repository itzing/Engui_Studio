# Studio Photo Session v1 Implementation Plan

Companion document to `docs/studio-photo-session-v1-spec.md`.

This document turns the approved product requirements into a staged implementation plan.
It is intentionally pre-ticket and pre-estimation. The goal is to define delivery order, system boundaries, and phase outputs before splitting work into backlog items.

---

## Delivery strategy

### Main implementation principles
- Build desktop-first only.
- Keep Studio Photo Session as a separate module, not an extension of the existing Create page.
- Treat templates and runs as different product surfaces from day one.
- Keep run config immutable after creation.
- Keep jobs temporary and materialize completed outputs into run-owned result records.
- Reuse existing Engui patterns where it reduces risk:
  - Prisma + Next API routes
  - workspace-scoped entities
  - gallery-style asset metadata shape
  - existing job execution pipeline
  - existing Character source data
- Keep the v1 pose library static and versioned in repo rather than building a new pose manager first.

### Recommended route and API shape

#### UI routes
- `src/app/studio-sessions/page.tsx`
- optional nested route later if needed:
  - `src/app/studio-sessions/[runId]/page.tsx`

#### API routes
Use a grouped API subtree to avoid flat route sprawl:
- `src/app/api/studio-sessions/templates/route.ts`
- `src/app/api/studio-sessions/templates/[id]/route.ts`
- `src/app/api/studio-sessions/templates/[id]/clone/route.ts`
- `src/app/api/studio-sessions/runs/route.ts`
- `src/app/api/studio-sessions/runs/[id]/route.ts`
- `src/app/api/studio-sessions/runs/[id]/assemble/route.ts`
- `src/app/api/studio-sessions/shots/[id]/pick/route.ts`
- `src/app/api/studio-sessions/shots/[id]/reshuffle/route.ts`
- `src/app/api/studio-sessions/shots/[id]/run/route.ts`
- `src/app/api/studio-sessions/shots/[id]/skip/route.ts`
- `src/app/api/studio-sessions/shots/[id]/restore/route.ts`
- `src/app/api/studio-sessions/versions/[id]/select/route.ts`
- `src/app/api/studio-sessions/versions/[id]/hide/route.ts`
- `src/app/api/studio-sessions/versions/[id]/add-to-gallery/route.ts`

Exact route splitting can be refined later, but the module should stay namespaced.

### Recommended v1 storage simplification
To keep v1 manageable:
- do **not** introduce a separate `SessionAsset` entity in addition to `ShotVersion`
- instead, let `ShotVersion` carry gallery-like asset metadata directly:
  - original URL
  - preview URL
  - thumbnail URL
  - content hash
  - generation snapshot
  - source job id

This still preserves the product model:
- `ShotVersion` is the result variant
- the data is stored in a separate run/session domain
- Gallery remains separate

This is the smallest implementation that still supports later extraction into a dedicated asset model if needed.

### Workspace model
All new entities should be workspace-scoped.
This matches current Engui architecture and keeps behavior aligned with:
- Characters
- Gallery assets
- Scenes
- Pose presets
- Prompt documents

---

## Existing code and patterns to leverage

### Persistence and API patterns
Use the same persistence style already present for:
- `ScenePreset`
- `PosePreset`
- `GalleryAsset`
- `Job`

### Character source
Use the existing Character API and Character Manager data as the only v1 source for template characters.

### Job execution
Do not build a second generation executor.
Studio Sessions should create ordinary jobs through the current generation flow, with added session context so completion can be materialized back into the correct run/shot/revision.

### Gallery transfer
Use the existing gallery asset creation logic as the basis for `Add to Gallery`, but keep session results isolated until the user explicitly imports them.

### Pose library handling
For v1, the provided pose library should live as a versioned static dataset under something like:
- `src/lib/studio-sessions/pose-library-v1.json`
- plus normalized helpers in `src/lib/studio-sessions/poseLibrary.ts`

This avoids building a pose manager/editor now, while still giving deterministic library behavior and a clear library version for snapshots.

---

## Proposed phase breakdown

## Phase 1 — Domain foundations and shared runtime helpers

### Goal
Create the data model, shared runtime utilities, and static pose-library layer that every later phase depends on.

### Deliverables
1. **Prisma schema additions** for workspace-scoped Studio Session entities.
   Recommended v1 models:
   - `StudioSessionTemplate`
   - `StudioSessionTemplateCategoryRule`
   - `StudioSessionRun`
   - `StudioSessionShot`
   - `StudioSessionShotRevision`
   - `StudioSessionShotVersion`

2. **Template draft/save model**.
   Recommended approach:
   - canonical saved template fields used by `Create Run`
   - separate `draftStateJson` for autosaved in-progress editor state
   - explicit Save promotes validated draft into canonical template fields

3. **Static pose library ingestion layer**.
   - normalize provided JSON
   - validate category/orientation/framing fields
   - expose stable category list for UI
   - expose stable library version/hash for snapshots

4. **Shared runtime helpers** under `src/lib/studio-sessions/`.
   At minimum:
   - category catalog helpers
   - unique-random pose picking helpers
   - auto-pick exhaustion detection
   - manual pose eligibility helpers
   - resolution derivation from short/long/square policy
   - prompt assembly helpers
   - run status derivation helpers
   - shot label helpers (`Standing 1`, etc.)

5. **Type layer** for templates, runs, shots, revisions, versions, and route payloads.

### Design choices to lock in this phase
- `ShotVersion` stores session asset fields directly in v1.
- run statuses are computed from shot states, not from job states alone.
- pose uniqueness rules for automatic assignment are enforced per run.
- manual pose picking may intentionally reuse a pose already seen in the run.

### Out of scope for this phase
- no production UI yet
- no run execution yet
- no gallery transfer yet

### Exit gate
This phase is done when the repo has a stable schema, migrations, typed helpers, and a normalized pose-library layer ready for UI/API consumption.

---

## Phase 2 — Template persistence, list surface, and editor shell

### Goal
Make templates real, editable, listable objects before touching runs.

### Deliverables
1. **Desktop route shell** for Studio Sessions.
   - new standalone route
   - top-level tabs: Templates / Runs
   - no mobile work

2. **Template list view**.
   - list templates for active workspace
   - create new template
   - open existing template
   - duplicate template
   - show save/draft state at a pragmatic level if useful

3. **Template CRUD API**.
   - create template
   - fetch templates
   - update template draft
   - explicit save/publish template
   - clone template

4. **Template editor v1 fields**.
   - character picker from existing Character source
   - inline environment text
   - inline outfit text
   - inline hairstyle text
   - master positive prompt
   - master negative prompt
   - generation settings block
   - short side / long side / square-side-source controls
   - compact scrollable category slider panel

5. **Autosave behavior**.
   Recommended implementation:
   - editor changes autosave into template draft state
   - explicit Save validates and writes canonical saved state
   - `Create Run` uses canonical saved state only

### UI guidance
- keep the editor desktop-first and dense
- do not mix run concepts into the template editor
- do not preview random selected poses in the template editor
- do not build shot-level editing here

### Out of scope for this phase
- no run creation yet
- no shot list yet
- no execution yet

### Exit gate
This phase is done when a user can create, edit, autosave, explicitly save, and clone templates entirely through the new Studio Sessions surface.

---

## Phase 3 — Run creation, snapshotting, and stable shot slots

### Goal
Create immutable runs from saved template snapshots and render the run workspace before any generation starts.

### Deliverables
1. **Run creation pipeline**.
   - create run from saved template snapshot
   - copy all required template data into run snapshot fields
   - preserve library version used at run creation time

2. **Stable shot-slot generation**.
   - create shot slots from category counts
   - assign stable ordering
   - assign human-readable labels per category/index
   - initialize slots as unassigned

3. **Run persistence and list API**.
   - list runs for active workspace
   - open run details
   - compute and return run product status

4. **Run viewer/editor shell**.
   - grouped by category
   - stable slot ordering
   - empty/unassigned shot cards
   - run-level actions area reserved for later actions

5. **Initial run states**.
   - Draft when just created
   - Ready when it is usable as a working object

### Important implementation rules
- run config becomes immutable immediately after creation
- no template edits may affect existing runs
- creating a run must not automatically assign poses to all shots
- creating a run must not automatically start jobs

### Out of scope for this phase
- no pose picking yet
- no run-all execution yet
- no version browsing yet

### Exit gate
This phase is done when a saved template can produce a real immutable run with grouped unassigned shot slots visible in the Runs surface.

---

## Phase 4 — Pose assignment workflows and shot preparation

### Goal
Make the run usable before generation by supporting lazy pose assignment, pick-all, manual selection, and reshuffle.

### Deliverables
1. **Shot assignment actions**.
   - Pick pose for one unassigned shot
   - Pick all / Assemble all for run
   - manual pose picker for one shot
   - reshuffle pose for one assigned shot

2. **Automatic unique-random behavior**.
   - no repeated auto-assigned poses inside one run
   - reshuffle excludes already auto-used poses from that run
   - exhausted category pools leave slots unassigned with a visible reason

3. **Manual pose picker behavior**.
   - restricted to shot category
   - may intentionally pick a previously used pose

4. **First revision creation**.
   - assigning a pose creates the first `ShotRevision`
   - reshuffling creates a new `ShotRevision`
   - new revision inherits prior revision state except pose-derived fields

5. **Assigned shot cards**.
   - pose name
   - orientation
   - framing
   - short prompt preview
   - Run shot
   - Reshuffle pose

6. **Bulk assembly behavior**.
   - fills existing stable slots
   - does not reorder UI

### Technical notes
- prompt preview should be generated from real assembly helpers, not duplicated UI logic
- revision creation must already be designed so later job completion can hang versions under it cleanly

### Out of scope for this phase
- no real result materialization yet
- no detailed version review yet

### Exit gate
This phase is done when a run can move from empty slots to a fully or partially assigned shot plan using both automatic and manual pose workflows.

---

## Phase 5 — Shot execution and job-to-version materialization

### Goal
Connect Studio Sessions to the real generation pipeline and materialize completed jobs into shot versions.

### Deliverables
1. **Run-shot execution actions**.
   - Run shot
   - Run all runnable shots in run
   - unassigned `Run shot` must auto-pick pose, create revision, then launch job

2. **Job context propagation**.
   Jobs created from Studio Sessions must carry enough metadata to map completion back to:
   - workspace
   - run
   - shot
   - revision
   - execution mode
     - fresh run from shot spec
     - variant/reshoot from selected version

3. **Completion materialization pipeline**.
   On successful job completion:
   - create a new `ShotVersion`
   - persist gallery-like asset fields on the version
   - link `sourceJobId`
   - attach generation snapshot
   - clear active-job state from primary shot UI

4. **Selected version rules**.
   - first successful version auto-becomes selected
   - later versions do not auto-replace selected

5. **Version lineage support**.
   - support ordinary reshoot/variant under the same revision
   - retain prior versions

6. **Separate session-result storage namespace**.
   File placement should not mix raw run results into gallery storage semantics even if the underlying utilities are shared.

### Important design decision
Do not keep the run primarily job-shaped after completion.
Once the artifact is materialized, the run should primarily read from revisions and versions.

### Out of scope for this phase
- no full review polish yet
- no gallery transfer UI yet

### Exit gate
This phase is done when running a shot or a run produces stable `ShotVersion` records and the run can show completed outputs independently of active job rows.

---

## Phase 6 — Review, curation, and final run workflow

### Goal
Turn runs into usable curation workspaces rather than raw generation logs.

### Deliverables
1. **Card-level quick review**.
   - browse versions quickly on shot card
   - show version position/index where helpful
   - select shown version as current final version

2. **Detailed shot viewer**.
   - current revision first
   - browse versions inside current revision
   - show previous revisions separately as history
   - clearly distinguish revision change vs version change

3. **Curation actions**.
   - Select version
   - Hide / Reject version
   - Skip shot
   - Restore shot
   - Add selected or visible version to Gallery

4. **Run status transitions**.
   - Draft
   - Ready
   - In progress
   - Needs review
   - Completed

5. **Completion rules**.
   - skipped shots do not block completion
   - completed means every non-skipped shot has a selected version

6. **Gallery transfer**.
   - explicit Add to Gallery only
   - no automatic sync

### UX guardrails
- do not add favorite/star state in v1
- do not add export packaging in v1
- do not add run clone in v1

### Exit gate
This phase is done when a user can start with a created run, generate results, curate variants, skip or restore slots, choose final versions, and send selected outputs to Gallery manually.

---

## Phase 7 — Hardening, QA, and implementation cleanup

### Goal
Reduce regression risk and make the module safe to expand into tickets and later follow-up work.

### Deliverables
1. **Code cleanup and consolidation**.
   - remove duplicated prompt assembly or status logic
   - centralize session helper utilities
   - tighten API payload validation

2. **Regression test coverage**.
   Recommended minimum coverage:
   - template draft/save separation
   - run snapshot immutability
   - auto-pick uniqueness rules
   - reshuffle exclusion rules
   - manual repeated-pose allowance
   - resolution derivation logic
   - first-version auto-select behavior
   - skip/restore completion rules
   - add-to-gallery transfer behavior

3. **Manual QA matrix**.
   Validate at least:
   - create/edit/save/clone template
   - create run from saved template snapshot
   - pick one shot manually
   - assemble all shots automatically
   - run one empty shot
   - run all assigned shots
   - reshuffle assigned shot
   - reshoot selected version
   - hide version
   - skip and restore shot
   - add version to gallery
   - verify completed status behavior

4. **Performance and usability pass**.
   - large run with many shots
   - multiple revisions on same shot
   - multiple versions on same revision
   - stable UI ordering under updates

### Exit gate
This phase is done when the module is stable enough to split remaining work into smaller follow-up enhancements without rethinking the base architecture.

---

## Suggested ticket slicing strategy after this doc

When we move to tickets, the cleanest split is:
1. schema/helpers
2. template APIs
3. template editor UI
4. run creation/list/view shell
5. pose assignment flows
6. run-shot execution
7. materialization into versions
8. review viewer and curation actions
9. gallery transfer
10. QA/polish

That preserves meaningful vertical milestones and avoids mixing domain foundation work with late-stage UI polish in the same task.

---

## Explicit non-goals for the first implementation wave

Do not pull these into the first wave unless a blocker appears:
- mobile Studio Sessions UI
- multi-character sessions
- editable run config after creation
- export package generation
- run cloning
- separate environment/outfit/hairstyle managers
- template-level random pose preview
- full shot-level prompt override editor
- full category override editor

---

## Recommended first coding order

If implemented strictly in order, the safest sequence is:
1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4
5. Phase 5
6. Phase 6
7. Phase 7

This order is intentional:
- it prevents UI-first drift without a solid domain model
- it locks template/run immutability early
- it keeps job materialization aligned with the real final product model
- it avoids building curation UI on top of unstable result storage
