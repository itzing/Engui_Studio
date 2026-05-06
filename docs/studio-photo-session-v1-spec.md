# Studio Photo Session v1 Specification

## Purpose

Studio Photo Session is a new desktop-first Engui module for building reusable single-character studio photoshoot templates and working through concrete run sessions derived from those templates.

The module is intended to support a curated workflow:
- design a reusable template,
- create a run from a template snapshot,
- assign or generate poses per shot,
- run individual shots or the whole run,
- keep multiple result variants per shot,
- choose final selected variants inside the run,
- optionally send good results to Gallery manually.

This specification captures product requirements only. It does not define implementation plan, storage schema details, or execution milestones.

---

## Scope

### v1 in scope
- Desktop-first UI.
- Separate product section/page, not part of the main Create flow.
- Templates and Runs as distinct top-level surfaces.
- Single-character session templates.
- Inline environment / outfit / hairstyle fields.
- Pose-library-driven shot assignment.
- Run-time curation with revisions, versions, selection, hide/reject, skip/restore.
- Manual "Add to Gallery" from run results.

### v1 out of scope
- Mobile authoring UI.
- Multi-character sessions.
- Full environment/outfit/hairstyle managers.
- Full export pipeline.
- Run cloning.
- Run-level config editing after creation.
- Shot-by-shot prompt editing before generation.
- Template-level random pose assignment preview.
- Full shot-level prompt override UI.

---

## Product Surfaces

The module must exist as a separate desktop section/page.

Top-level tabs:
- Templates
- Runs

### Templates surface
Must support:
- list templates
- create template
- edit template
- duplicate/clone template
- create run from template

### Runs surface
Must support:
- list runs
- open run viewer/editor
- continue work on active runs

---

## Core Domain Model

### Session Template
A reusable editable configuration for a studio photoshoot.

Template requirements:
- stores one selected Character reference
- stores inline Environment text
- stores inline Outfit text
- stores inline Hairstyle text
- stores master positive prompt
- stores master negative prompt
- stores generation settings snapshot source
- stores category count rules
- stores resolution side policy
- supports autosaved draft state during editing
- supports explicit Save
- supports Clone / Duplicate

A template edit must not mutate existing runs.

### Session Run
A working session created from a template snapshot.

Run requirements:
- created from a template snapshot
- template edits after run creation must not affect the run
- acts as a working container, not as a one-time execution event
- may exist before any jobs are launched
- may launch the whole run or individual shots independently
- presents current selected results across shots as the effective final set

Run config is immutable after creation.
Only shot-level operations are allowed inside a run.

### Shot
A stable slot within a run.

Shot requirements:
- belongs to one run
- belongs to one category
- has stable identity and stable order within the run
- may start unassigned
- may be skipped and later restored
- may have multiple revisions over time
- has one current selected version across its revision history

### Shot Revision
A revision of a shot slot representing a specific pose/config state for that slot.

Revision requirements:
- created when a pose is assigned for the first time
- created when a shot pose is reshuffled or manually replaced
- inherits prior shot revision state except fields directly derived from pose
- changes at least:
  - pose id
  - pose snapshot
  - derived orientation
  - derived framing
  - assembled prompt snapshot and any pose-dependent derived fields
- may later hold shot-level override fields in the data model, even if v1 UI does not expose them

### Shot Version
A generated result variant under a specific shot revision.

Version requirements:
- created from a completed job result
- stored in a separate run/session asset domain, not in Gallery
- retains generation snapshot metadata
- may be selected as the shot's final chosen version
- may be hidden/rejected without hard deletion
- must not be hard-deleted in v1

### Jobs
Jobs are temporary execution objects.

Job requirements:
- exist only to produce artifacts
- may be shown while active/in progress
- when completed, their result must be materialized into the run asset/version domain
- after completion, the run should primarily reference stored shot versions rather than persistent job objects

---

## Character and Supporting Inputs

### Character
- v1 supports exactly one character per template.
- Character must come from the existing Character Manager.
- No multi-character support in v1.

### Environment / Outfit / Hairstyle
- v1 uses inline text fields only.
- These are not backed by dedicated managers in v1.
- The data model should remain extensible so these can later become reusable entities usable both in Studio Sessions and Prompt Constructor.

---

## Prompt Construction

A shot prompt must be assembled automatically from:
- character-derived data
- environment
- outfit
- hairstyle
- master positive prompt
- master negative prompt
- selected pose prompt
- generation settings and derived composition context as needed

### Category override support
v1 does not expose category-level override UI.
However, the data model must leave room for future category-level overrides.

### Shot-level override support
v1 does not expose shot-level prompt override UI.
However, the data model must leave room for future shot/revision-level override fields.

### Pre-run prompt review
Before generation, users may see prompt previews on shot cards and in run context.
Users do not edit prompts shot-by-shot in v1.

---

## Pose Library Usage

The supplied pose library is the source of poses.

Each pose provides at least:
- id
- category
- orientation
- framing
- name
- prompt

### Category selection model
Template stores category rules as an extensible structure, not as hard-coded fields.

Current v1 rule fields:
- category
- count

Future expansion room should exist for fields such as:
- includedPoseIds
- excludedPoseIds
- preferredOrientation
- preferredFraming
- fixedPoseIds
- weighting or priority controls

### v1 category-count UI
Template editor must present category counts as:
- a compact, scrollable container
- one slider per category
- slider range: 0..20
- default value: 5
- 0 means category disabled for that template

### Random assignment rules
Automatic pose selection must:
- default to unique random within category
- avoid reusing poses already auto-assigned or reshuffled into the same run
- not repeat prior automatically used poses in the same run when reshuffling a shot

### Manual pose assignment rules
Users must be able to manually choose a pose for a shot.

Manual pose picker rules:
- limited to the shot category
- may intentionally select a pose already used earlier in the same run
- is distinct from automatic unique-random assignment

---

## Resolution and Orientation Policy

The template does not directly store fixed width/height pairs per orientation.
Instead it stores:
- short side
- long side
- square side source: short or long

Run-time resolution derivation:
- portrait pose -> short x long
- landscape pose -> long x short
- square pose ->
  - short x short if square side source = short
  - long x long if square side source = long

Pose orientation is authoritative for deriving output orientation.

---

## Template Editing Requirements

Template editor must support:
- autosaved draft state
- explicit Save
- explicit Clone / Duplicate
- selecting one Character from Character Manager
- editing inline Environment text
- editing inline Outfit text
- editing inline Hairstyle text
- editing master positive prompt
- editing master negative prompt
- configuring generation settings for the template
- configuring short side, long side, and square side source
- configuring category counts with compact scrollable sliders

Template editor does not:
- assign concrete random poses
- create finalized shot lists inside the template itself
- edit run state

---

## Run Creation and Run Lifecycle

### Run creation
Create Run must:
- create a run from a template snapshot
- create stable shot slots according to category count rules
- not require pose assignment immediately
- not require job execution immediately

Create Run must not automatically start all jobs.

### Run statuses
The run must support the following product statuses:
- Draft
- Ready
- In progress
- Needs review
- Completed

Status intent:
- Draft: newly created run with no meaningful work yet
- Ready: run is usable even if some or all shots are still unassigned
- In progress: some jobs have started or active work exists
- Needs review: assets exist but final selection is not finished across all required shots
- Completed: all non-skipped shots have a selected final version

### Run immutability
After creation, run-level config must not be editable.
Only shot-level operations are allowed.

---

## Shot Slot Behavior

### Stable slot structure
Run creates stable shot slots up front.
UI order must remain stable.
Automatic fill actions must populate existing slots instead of reordering them.

### Grouping and labels
Run UI must group shots by category.
Shot labels must be human-readable, such as:
- Standing 1
- Standing 2
- Portrait 1

### Empty/unassigned shot card
An unassigned shot card must show:
- category/slot label
- Unassigned state
- action: Pick pose
- action: Run shot

### Assigned but not yet generated shot card
An assigned shot card must show at least:
- pose name
- orientation
- framing
- short prompt preview
- action: Run shot
- action: Reshuffle pose

---

## Pose Assignment Workflow

### Lazy assignment
Run creation may leave shots without poses.

If a shot has no pose yet:
- user may pick manually
- user may later use a bulk action to assign all
- user may press Run shot and the system must auto-pick a pose first

### Run-shot behavior for unassigned shot
If Run shot is pressed on an unassigned shot, the system must:
1. auto-pick a pose according to slot/category rules
2. create a shot revision
3. launch the job

### Pick all / Assemble all
Run UI must provide a bulk action to assign poses across the run.
This action must:
- fill existing stable slots
- not reorder UI
- respect automatic no-repeat rules for auto-picked poses

### Reshuffle shot
Reshuffle is a pose replacement action for one shot.
It must:
- create a new shot revision
- keep the same shot slot identity
- preserve inherited shot context
- choose a new automatic pose that has not already appeared through automatic assignment in that run
- not reuse prior automatically used poses from the run's history

---

## Generation Workflow

### Launching work
Inside a run, the user must be able to:
- run one shot
- run all runnable shots in the run

### Shot execution semantics
- A shot can accumulate multiple versions under the same revision through reshoots/variants.
- If a shot already has a selected/current version, a reshoot creates another version rather than replacing prior results.

### Reshoot and variant modes
The data model must support both:
- rerun from shot specification
- variant from selected version

v1 primary UX should be oriented around:
- reshoot from selected version

---

## Result Storage and Asset Behavior

Completed shot results must be stored in a domain separate from Gallery.

Requirements:
- use a dedicated session/run asset domain
- keep structure compatible in spirit with Gallery asset handling where practical
- do not automatically appear in Gallery
- remain available in run UI as shot versions

### Add to Gallery
A run result must be movable to Gallery only through explicit user action.
There is no automatic Gallery sync.

---

## Revision and Version Review UX

### Card-level quick review
For shots with multiple versions:
- the card should support quick version browsing
- the card should show current version index context where helpful
- the card should allow selecting a shown version as the chosen final version

### Detailed viewer
Opening a shot detail viewer must:
- default focus to the current revision
- allow browsing versions within that revision
- expose previous revisions as separate history

The UI should distinguish clearly between:
- another version of the same revision
- a different revision caused by pose reshuffle/manual pose replacement

---

## Selection Rules

### Final selected version
Each shot must have at most one selected final version at a time.

### Auto-selection behavior
- The first successful version for a shot should auto-become the selected version.
- Later successful versions must not auto-replace the selected version.
- Changing selected version is a user action.

### Run completion logic
A run is effectively the current selected set across its shots.
No separate export layer is needed in v1.

---

## Hidden / Rejected Versions

Shot versions must support soft hiding/rejection.

Requirements:
- hidden/rejected versions stay in history
- they are not hard-deleted in v1
- they should not dominate the primary review surface

No separate favorite/star system is required in v1.
If a result is especially good, it can simply be sent to Gallery.

---

## Skip / Restore Shot

Shots must support:
- Skip
- Restore

Requirements:
- skipped shots are not hard-deleted
- skipped shots do not block run completion
- Completed requires selected versions only for non-skipped shots
- no separate archived/disabled state is required in v1 beyond skipped + restore

---

## Handling Exhausted Pose Pools

If a category requests more automatically unique shots than available unique poses:
- the system must not auto-repeat poses
- unfillable slots should remain unassigned
- the run must not fail entirely
- the UI should clearly indicate that the unique pose pool for that category is exhausted

---

## Non-Requirements for v1

The following are intentionally not required in v1:
- multi-character session support
- mobile editing UX
- run cloning
- full export package generation
- full prompt editing per shot before execution
- run-level config editing after creation
- automatic sync of run results into Gallery
- hard deletion of shot versions
- additional favorite/star state for versions
- full manager surfaces for environment/outfit/hairstyle
- full category override editor UI
- full shot-level override editor UI

---

## Summary of v1 Product Principles

1. Templates design repeatable session intent.
2. Runs are immutable snapshots of templates.
3. Runs are working curation containers, not one-time batch executions.
4. Shots are stable slots.
5. Revisions represent pose/config changes for a slot.
6. Versions represent generated result variants under a revision.
7. Jobs are temporary execution tools, not the long-term result model.
8. Gallery remains separate from run storage.
9. Automatic systems should be controllable, but manual override must exist where creative control matters.
10. The v1 UI should stay compact and pragmatic while the data model remains extensible for future control layers.
