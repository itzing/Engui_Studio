# Prompt Constructor, Scene Template v2 Spec

## Goal

Rework the current desktop Prompt Constructor into a reusable **scene template editor** for **Z-Image Turbo**.

The new system must let the user:
- create and save reusable scenes,
- define a dynamic number of character slots,
- describe poses and spatial relationships between characters,
- reopen saved scenes and quickly swap characters, environment, style, or constraints,
- generate from the current scene state,
- persist an immutable serialized **scene snapshot** on the resulting job and later on gallery items for reuse.

This is still the Prompt Constructor feature path. The product direction is not to revive a separate Scene Manager surface.

---

## Superseded direction

This spec supersedes the old single-character-only product direction captured in `docs/prompt-constructor-single-character-v1-spec.md`.

It also absorbs the useful reusable-scene ideas from `docs/scene-manager-spec.md`, but keeps implementation inside the existing Prompt Constructor shell, persistence flow, and template architecture.

---

## Product decision summary

- Prompt Constructor remains the home for structured prompt authoring.
- The primary authored object becomes a **scene**, not a one-off single-character prompt document.
- The system is **scene-centric** and **multi-character by design**.
- The number of character slots is dynamic and controlled by the user.
- Character-to-character positioning and interaction are first-class structured data, not hidden inside one prose field.
- The rendered prompt stays a **derived artifact**, never the source of truth.
- Save, search, load, duplicate, and preview must continue to work from the current Prompt Constructor flow.
- Generation must persist an immutable serialized **scene snapshot**.
- Job and gallery reuse must start from that snapshot, not from whatever the current mutable scene template later becomes.
- Desktop only for this redesign. Mobile Prompt Constructor stays unchanged.
- No multi-panel or comic-page support in this version.

---

## Scope

### In scope

- New structured scene-template model for Prompt Constructor
- Dynamic character slots with add, remove, duplicate, and reorder actions
- Explicit relation and staging data between characters
- Scene summary, composition, environment, style, and constraints sections
- Deterministic prompt rendering for Z-Image Turbo using ordered semantic blocks
- Save, load, duplicate, search, and preview flows for saved scenes
- Immutable scene snapshot serialization for jobs
- Immutable scene snapshot serialization for gallery items
- Reuse flow from saved scene, job snapshot, and gallery snapshot
- Continued use of the current desktop Prompt Constructor shell with updated section structure

### Out of scope

- Mobile Prompt Constructor redesign
- Multi-panel or comic-page prompting
- Raw prompt editing as a primary authoring mode
- Negative prompt as a first-class core field
- Automatic extraction from arbitrary existing prompts
- LLM-first scene parsing from summary as the main flow
- Automatic synchronization of already-generated jobs when the source scene later changes
- Storyboard or sequence editing

---

## Why the current Prompt Constructor should be reused

The current Prompt Constructor already has the right foundational pieces:
- document save and load flows,
- a template-aware architecture,
- preview behavior,
- validation surfaces,
- a desktop editing shell with section navigation and helper surfaces.

The product should reuse that foundation instead of creating another composition surface that will later compete with it.

The redesign therefore changes:
- the primary data model,
- the template schema,
- the editor sections,
- the rendered prompt structure,
- the persistence metadata,
- the job and gallery integration contract.

It does **not** create a separate product surface.

---

## Primary user workflows

### 1. Create a reusable scene
The user opens Prompt Constructor, creates a new scene, adds one or more character slots, defines poses and character relationships, fills scene blocks, previews the rendered prompt, and saves the scene.

### 2. Reopen and adapt a scene
The user searches for an existing scene, opens it, swaps one or more characters, changes environment or style, adjusts staging, and saves or duplicates it.

### 3. Generate from a scene
The user generates from the current scene. The system renders the prompt deterministically and stores an immutable serialized scene snapshot on the job.

### 4. Reuse from a job
The user opens a job, chooses a reuse action, and gets a new editable Prompt Constructor draft created from the job's serialized scene snapshot.

### 5. Reuse from a gallery item
The user opens a gallery item saved from a job, chooses a reuse action, and gets a new editable Prompt Constructor draft created from the gallery item's serialized scene snapshot.

---

## Core entities

## 1. Editable scene document

The editable source object should continue to use the current Prompt Constructor persistence flow.

Preferred strategy:
- keep the existing Prompt Constructor document record as the editable persistence shell,
- store the new scene state inside it,
- set the active template identifier to `scene_template_v2`,
- surface the saved object to users as a **scene** in the UI even if the internal persistence name still says document.

This lets the product reuse save/load/search infrastructure while changing what the authored state actually represents.

## 2. Scene template state

The authored scene data must be plain JSON and must not contain UI-only state.

```ts
interface SceneTemplateState {
  schemaVersion: 1;
  sceneSummary: SceneSummary;
  characterSlots: CharacterSlot[];
  characterRelations: CharacterRelation[];
  composition: CompositionBlock;
  environment: EnvironmentBlock;
  style: StyleBlock;
  constraints: ConstraintBlock;
}
```

## 3. Scene snapshot

A scene snapshot is the immutable serialized record captured at generation time.

It must include:
- enough scene data to fully reconstruct the authoring state later,
- the rendered prompt used for generation,
- the template identifier and schema version,
- warnings produced during rendering,
- source scene identity when available.

```ts
interface SceneSnapshot {
  schemaVersion: 1;
  templateId: 'scene_template_v2';
  sourceDocumentId: string | null;
  sourceDocumentTitle: string | null;
  capturedAt: string;
  state: SceneTemplateState;
  renderedPrompt: string;
  warnings: string[];
}
```

The snapshot must be self-contained enough for reuse even if linked presets later change.

---

## Scene data model

## Scene summary

Scene summary is a searchable compact description of the scene intent.

```ts
interface SceneSummary {
  sceneType: string;
  mainEvent: string;
  notes: string;
  tags: string[];
}
```

Recommended usage:
- `sceneType`: concise category such as `portrait`, `conversation`, `dramatic confrontation`, `romantic close scene`
- `mainEvent`: one-sentence scene intent
- `notes`: extra context that does not fit the main event
- `tags`: reusable search tags

## Character slots

Character slots are the main dynamic structure.
One scene may have one or many character slots.

```ts
interface CharacterSlot {
  id: string;
  label: string;
  role: string;
  enabled: boolean;
  presetRef: {
    id: string;
    name: string;
  } | null;
  posePresetRef: {
    id: string;
    name: string;
  } | null;
  fields: CharacterFields;
  staging: CharacterStaging;
}
```

```ts
interface CharacterFields {
  nameOrRole: string;
  ageBand: string;
  genderPresentation: string;
  appearance: string;
  outfit: string;
  expression: string;
  pose: string;
  localAction: string;
  props: string[];
}
```

```ts
interface CharacterStaging {
  screenPosition: string;
  depthLayer: string;
  bodyOrientation: string;
  stance: string;
  relativePlacementNotes: string;
}
```

Important rules:
- `presetRef` and `posePresetRef` are optional helpers, not the source of truth.
- `fields` and `staging` must always be serializable plain JSON.
- A snapshot must remain reusable even if preset references disappear or change later.

## Character relations

Character relations make multi-character scenes reliable.
They must be stored separately from freeform prose.

```ts
interface CharacterRelation {
  id: string;
  subjectId: string;
  targetId: string;
  relationType: string;
  distance: string;
  eyeContact: string;
  bodyOrientation: string;
  contactDetails: string;
  relativePlacement: string;
  dramaticFocus: string;
  notes: string;
}
```

Minimum supported relation semantics should include:
- `facing`
- `looking-at`
- `talking-to`
- `confronting`
- `supporting`
- `embracing`
- `holding`
- `touching`
- `following`
- `custom`

## Composition

```ts
interface CompositionBlock {
  shotSize: string;
  cameraAngle: string;
  framing: string;
  subjectPlacement: string;
  foregroundPriority: string;
  backgroundPriority: string;
}
```

## Environment

```ts
interface EnvironmentBlock {
  location: string;
  timeOfDay: string;
  lighting: string;
  weather: string;
  background: string;
  environmentDetails: string;
}
```

## Style

```ts
interface StyleBlock {
  medium: string;
  visualStyle: string;
  detailLevel: string;
  colorPalette: string;
  mood: string;
  renderingStyle: string;
}
```

## Constraints

```ts
interface ConstraintBlock {
  mustKeep: string[];
  mustAvoid: string[];
  consistencyRequirements: string[];
  layoutConstraints: string[];
  textConstraints: string[];
}
```

---

## Rendering model

The renderer must stay deterministic and block-based.

### Canonical block order

1. Scene summary
2. Character blocks, one per enabled character slot in stable order
3. Character relations / interaction block
4. Composition block
5. Environment block
6. Style block
7. Constraints block

### Rendering rules

- Keep block order fixed.
- Omit empty blocks cleanly.
- Normalize repeated commas and whitespace.
- Keep constraints last.
- Do not introduce uncontrolled prompt enhancement.
- Keep the output human-readable and directly traceable to the scene state.

### Canonical prompt skeleton

```text
Scene: {scene_summary}.
Character 1: {character_block_1}.
Character 2: {character_block_2}.
Interaction: {relation_summary}.
Composition: {composition_block}.
Environment: {environment_block}.
Style: {style_block}.
Constraints: {constraint_block}.
```

A single-character scene is simply the same structure with one character block and an optional empty relation block.

---

## UX specification

## Overall layout

Reuse the current desktop Prompt Constructor shell and adapt its sections to the new scene model.

Target section order:
- Scene Summary
- Characters
- Relations
- Composition
- Environment
- Style
- Constraints

The existing desktop patterns should remain where they still help:
- compact top toolbar,
- left section rail,
- main section-focused editor,
- right helper surface,
- preview-on-demand modal.

## Top toolbar

The toolbar must support:
- search saved scenes,
- open scene,
- rename scene,
- refresh scene list,
- duplicate scene,
- create new scene,
- preview rendered prompt,
- save scene.

User-facing wording should move toward **Scene** rather than **Document**.

## Characters section

The Characters section must support:
- add character slot,
- remove character slot,
- duplicate character slot,
- reorder character slots,
- edit label and role,
- assign a Character preset,
- assign a Pose preset,
- manually override character fields,
- manually override staging fields.

## Relations section

The Relations section must support:
- add relation,
- remove relation,
- choose subject and target slots,
- choose relation type,
- define distance and eye contact,
- define body orientation and contact details,
- define relative placement and dramatic focus,
- add freeform notes.

If the scene has only one enabled character slot, the Relations section may collapse to a lightweight informational state.

## Helper surface

The right helper surface should stay context-aware.

Recommended behavior:
- when a character slot field is active, show Character and Pose suggestions relevant to that slot,
- when a relation field is active, show relation-oriented guidance or reusable phrasing,
- when environment or style fields are active, show relevant reusable library fragments,
- when constraints are active, show common quality and anatomy guardrails.

## Preview behavior

Preview remains on demand.
It should show:
- rendered prompt,
- validation warnings,
- the source scene title,
- quick copy action.

---

## Save, load, search, and duplication

Saved scenes must be searchable and easy to reopen.

### Required searchable metadata

Saved scene list/search should be able to use:
- title,
- scene type,
- tags,
- character count,
- last updated timestamp.

Preferred implementation:
- derive searchable metadata from `SceneTemplateState` and persist it alongside the editable document record, or
- compute it server-side and include it in list responses.

The exact storage shape may vary, but the UI must not have to download every full scene payload just to build the scene list.

### Duplicate flow

The user must be able to duplicate a saved scene and continue editing the duplicate as a separate scene.

---

## Validation rules

Validation should stay warning-based, not hard-blocking by default.

Minimum rules:
- a saved scene must have a title,
- there must be at least one enabled character slot,
- relation `subjectId` and `targetId` must point to existing enabled character slots,
- if a character slot has no preset reference, it should still have enough manual data to be meaningful,
- if there are multiple enabled character slots and no relations, show a warning,
- if there are multiple enabled character slots and subject placement is empty, show a warning,
- if constraints are empty, show a warning,
- if the rendered prompt becomes structurally thin because too many major blocks are empty, show a warning.

---

## Serialization requirements

Scene data must serialize cleanly as plain JSON.

### Serialization goals

- safe to store on a job record,
- safe to store on a gallery item,
- safe to clone into a new draft,
- safe to export later,
- no dependency on live UI state,
- no dependency on currently available preset records for basic reuse.

### Snapshot rules

- A snapshot must capture the exact scene state used at generation time.
- A snapshot must capture the rendered prompt used at generation time.
- Editing the source scene later must not mutate old job or gallery snapshots.
- Reuse from job or gallery must initialize from the stored snapshot, not from the latest current scene template.

---

## Job integration

When generation starts from Prompt Constructor:
- render prompt from the current editable scene state,
- create a `SceneSnapshot`,
- attach that snapshot to the job,
- keep the rendered prompt on the job as today,
- store the source scene id when available.

Required job-level fields or equivalent payload:
- `sceneSnapshotJson`
- `sceneTemplateId` nullable
- `renderedPrompt`

The exact persistence location may follow existing job metadata patterns, but the data must be queryable for later reuse.

---

## Gallery integration

When a job result is saved into the gallery, the gallery item should also persist the associated scene snapshot.

Required gallery-level fields or equivalent payload:
- `sceneSnapshotJson`
- `sourceJobId`
- `sceneTemplateId` nullable
- `renderedPrompt`

This is what enables later **Reuse Scene** from a gallery item without relying on the original scene still existing unchanged.

---

## Compatibility and migration

This redesign should not throw away the current Prompt Constructor foundation.

### Required migration posture

- `scene_template_v2` becomes the new default creation flow.
- Existing `single_character_scene_v1` documents remain loadable.
- Legacy documents may stay editable under their original template until they are explicitly retired later.
- The new scene-template flow must not require destructive migration of old saved prompt documents on day one.

This minimizes risk while shifting the default product direction.

---

## Implementation guidance

Break implementation into slices that match product value:
1. scene template state, renderer, validation, and serialization contract,
2. scene-oriented save/load/search and scene terminology,
3. dynamic character slots,
4. explicit relations and staging,
5. scene snapshot attachment to jobs,
6. scene snapshot attachment to gallery items,
7. default-template switch, migration handling, and QA.

---

## Acceptance criteria

- [ ] Prompt Constructor supports a new `scene_template_v2` authoring flow for single-image scenes
- [ ] Users can add and edit a dynamic number of character slots
- [ ] Users can express structured relations between characters
- [ ] Saved scenes can be searched, loaded, duplicated, and edited from Prompt Constructor
- [ ] Generation persists an immutable serialized scene snapshot on the job
- [ ] Gallery items can persist the same serialized scene snapshot for later reuse
- [ ] Preview continues to render a deterministic prompt from structured scene data
- [ ] Existing legacy single-character documents remain loadable during migration
- [ ] Mobile Prompt Constructor behavior does not change in this phase
