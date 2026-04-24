# Prompt Constructor, Single Character v1 Spec

> Note: This document records the original single-character v1 direction. The current product direction is captured in `docs/prompt-constructor-scene-template-v2-spec.md`, which repurposes Prompt Constructor around reusable scene templates, dynamic character slots, and serialized scene snapshots.

## Goal

Add a desktop-first **Prompt Constructor** for **z-image turbo** that renders a final prompt from structured slot values using one deterministic template.

Version 1 is intentionally narrow:
- one template only
- no raw prompt editing
- no negative prompt field
- no variants
- no extraction flow
- no multi-template switching UI

The feature must still be architected so future templates can be added without rewriting the shell, storage model, or rendering pipeline.

---

## Product decision summary

This spec intentionally replaces the previous scene-manager-first direction for prompt authoring.

The new direction is:
- prompt-first
- template-driven
- rendered prompt always visible
- structured slot editing only
- reusable manager data used as library input, not as the main orchestration UX

The final prompt is a **derived artifact**.
It is never the source of truth in v1.

---

## V1 scope

### In scope
- desktop Prompt Constructor shell
- one template: `single_character_scene_v1`
- deterministic prompt renderer
- structured slot editing
- reusable block insertion from existing Character, Vibe, and Pose data
- constraint checklist with template defaults
- prompt document save/load
- prompt copy action
- validation warnings

### Out of scope
- raw prompt editing
- negative prompt
- prompt variants
- extraction from existing prompts
- multi-panel prompts
- multi-character prompts
- character-object prompts
- mobile UI
- generation backend orchestration
- scene manager integration as the primary UX

---

## Why this narrow version is correct

The product needs a real working foundation, not another temporary editor that will be thrown away when more templates arrive.

The shell must therefore already support:
- template registry
- typed state per template
- template-specific renderer
- template-specific validation
- reusable block providers
- constraint registry

Even though only one template is exposed in v1, the architecture must already be template-capable.

---

## Current system reuse

The current codebase already has reusable manager surfaces and storage for:
- `CharacterManagerPanel`
- `VibeManagerPanel`
- `PoseManagerPanel`
- `SceneManagerPanel`

### Reuse strategy

#### Character Manager
Use as a reusable library source for:
- appearance fragments
- identity traits
- body traits
- trait-derived character summary text

#### Vibe Manager
Use as a reusable library source for:
- style fragments
- atmosphere fragments
- mood fragments
- reusable `baseDescription` blocks

#### Pose Manager
Use as a reusable library source for:
- pose fragments
- body-language fragments
- single-character pose prompt snippets

#### Scene Manager
Do **not** use as the shell for this feature.
It was designed around editable assembled prompt snapshots and orchestration across managers.
That makes it the wrong foundation for a strict template-rendered prompt constructor.

Scene Manager may remain in the repo, but Prompt Constructor v1 should be implemented as a separate feature path.

---

## Important reality check about existing data

The current manager data does not map perfectly to the desired template slots.

### What exists today

#### CharacterSummary
Current character data contains:
- `name`
- `gender`
- `traits: Record<string, string>`
- no dedicated outfit field
- no dedicated expression field

#### VibePresetSummary
Current vibe data contains:
- `name`
- `baseDescription`
- `tags`
- `compatibleSceneTypes`

It does **not** currently store first-class fields like:
- palette
- mood
- detail level

#### PosePresetSummary
Current pose data contains:
- `summary`
- `posePrompt`
- `characters[]`
- `relationship`

For single-character prompts this is useful for:
- pose
- body orientation
- pose-derived action flavor

It is not a full action model.

### Engineering implication

V1 must support a mixed input model:
- some slot values come from library providers based on current manager data
- some slot values are authored directly inside the Prompt Constructor form

This is not a problem. It is the correct MVP behavior.

---

## Template: `single_character_scene_v1`

### Canonical rendered structure

```text
Character portrait or single-character scene.
Character: {appearance}, {outfit}, {expression}, {pose}.
Action: {main_action}.
Composition: {shot_type}, {camera_angle}, {framing}.
Environment: {location}, {time_of_day}, {lighting}, {background}.
Style: {style}, {detail_level}, {palette}, {mood}.
Constraints: {constraints}.
```

### Rendering rules
- omit empty sections cleanly
- normalize repeated commas and spaces
- keep section order fixed
- keep constraints last
- output plain prompt text only

### Example rendered output

```text
Character portrait or single-character scene.
Character: young European woman, shoulder-length dark brown hair, light summer dress, shy soft smile, sitting with one leg bent on the chair.
Action: adjusting her hair with one hand.
Composition: medium shot, eye level, balanced framing.
Environment: summer kitchen, late afternoon, warm golden sunset light, simple domestic background.
Style: cinematic realism, high detail, warm muted palette, intimate nostalgic mood.
Constraints: consistent anatomy, no extra people, no duplicated limbs, clear subject focus.
```

---

## UX specification

## Layout

### Left pane
The left pane is read-only prompt output.
It must always stay visible.

Contains:
- document title row
- rendered prompt surface
- copy rendered prompt action
- save action
- save status
- validation warnings

### Right pane
The right pane is the editor.

Tabs in v1:
1. `Slots`
2. `Library`
3. `Constraints`

No more tabs in v1.

---

## Left pane behavior

### Rendered prompt surface
- always visible
- updates immediately when slot values or constraints change
- read-only in v1
- scrollable for long prompts
- optimized for copyability

### Actions
- `Save`
- `Copy Prompt`

Optional secondary actions later, but not in v1.

### Validation surface
Show soft warnings only.
Do not block editing.

---

## Right pane behavior

## 1. Slots tab

The Slots tab is the primary structured editor.

### Sections
- Character
- Action
- Composition
- Environment
- Style

### Slot controls
Every slot must be editable directly in the constructor, regardless of whether a library source exists.

That means the slot editor is not just a picker. It is the main form.

### Required slots in v1

#### Character section
- `appearance`
- `outfit`
- `expression`
- `pose`

#### Action section
- `mainAction`

#### Composition section
- `shotType`
- `cameraAngle`
- `framing`

#### Environment section
- `location`
- `timeOfDay`
- `lighting`
- `background`

#### Style section
- `style`
- `detailLevel`
- `palette`
- `mood`

---

## 2. Library tab

The Library tab provides reusable prompt fragments from existing manager data.

### Purpose
It accelerates slot authoring without replacing direct slot control.

### Core behavior
When a slot is selected in the Slots tab, the Library tab filters results to matching categories.

Examples:
- selecting `appearance` shows character-derived appearance blocks
- selecting `pose` shows pose-derived snippets
- selecting `style` or `mood` shows vibe-derived fragments

### Actions
- `Replace slot`
- `Append to slot`
- `Clear slot`

### Important rule
The library inserts **text fragments into slot values**.
It never writes directly into the rendered prompt.

---

## 3. Constraints tab

Constraints are first-class reusable snippets.

### V1 default constraints for this template
- `consistent_anatomy`
- `no_extra_people`
- `no_duplicated_limbs`
- `clear_subject_focus`

### Tab behavior
- show template defaults first
- allow enable / disable via checklist
- allow search by label or tag
- render selected constraints in a stable order

---

## Core architecture

## Non-negotiable rule
The final prompt is always computed from structured state.

There is exactly one source of truth:
- the prompt document state

There is no second source of truth:
- not raw prompt text
- not manual override text
- not saved rendered snapshot

---

## Data model

## TemplateDefinition

```ts
export type TemplateDefinition<TState> = {
  id: string;
  version: number;
  title: string;
  sections: SectionDefinition[];
  slots: SlotDefinition[];
  createInitialState: () => TState;
  render: (state: TState, constraints: ConstraintSnippet[]) => string;
  validate: (state: TState, constraints: ConstraintSnippet[]) => ValidationIssue[];
};
```

## SectionDefinition

```ts
export type SectionDefinition = {
  id: string;
  label: string;
  slotIds: string[];
};
```

## SlotDefinition

```ts
export type SlotType = 'text' | 'enum' | 'library-text';

export type PromptBlockCategory =
  | 'appearance'
  | 'outfit'
  | 'expression'
  | 'pose'
  | 'action'
  | 'location'
  | 'time-of-day'
  | 'lighting'
  | 'background'
  | 'style'
  | 'detail-level'
  | 'palette'
  | 'mood';

export type SlotDefinition = {
  id: string;
  label: string;
  sectionId: string;
  type: SlotType;
  required?: boolean;
  placeholder?: string;
  enumOptions?: { label: string; value: string }[];
  libraryCategories?: PromptBlockCategory[];
};
```

## ConstraintSnippet

```ts
export type ConstraintSnippet = {
  id: string;
  label: string;
  content: string;
  applicableTemplateIds: string[];
  tags: string[];
};
```

## ValidationIssue

```ts
export type ValidationIssue = {
  id: string;
  level: 'warning';
  message: string;
  slotId?: string;
};
```

## PromptDocument

```ts
export type PromptDocument<TState> = {
  id: string;
  title: string;
  templateId: string;
  templateVersion: number;
  state: TState;
  enabledConstraintIds: string[];
  createdAt: string;
  updatedAt: string;
};
```

## SingleCharacterPromptState

```ts
export type SingleCharacterPromptState = {
  character: {
    appearance: string;
    outfit: string;
    expression: string;
    pose: string;
  };
  action: {
    mainAction: string;
  };
  composition: {
    shotType: string;
    cameraAngle: string;
    framing: string;
  };
  environment: {
    location: string;
    timeOfDay: string;
    lighting: string;
    background: string;
  };
  style: {
    style: string;
    detailLevel: string;
    palette: string;
    mood: string;
  };
};
```

---

## Template registry

Even though v1 exposes only one template, the shell must already use a registry.

```ts
export const promptTemplateRegistry = {
  single_character_scene_v1,
} as const;
```

### Why this matters
Later templates must be pluggable by adding:
- a new template state type
- a new template definition
- a new renderer
- optional new slot metadata

The workbench shell should not need a global rewrite.

---

## Provider architecture for reusable blocks

Existing managers should feed reusable prompt fragments through dedicated provider adapters.

## PromptBlock

```ts
export type PromptBlock = {
  id: string;
  label: string;
  content: string;
  category: PromptBlockCategory;
  source: 'characters' | 'vibes' | 'poses' | 'manual';
  tags: string[];
  sourceId?: string;
};
```

## PromptBlockProvider

```ts
export type PromptBlockProvider = {
  source: 'characters' | 'vibes' | 'poses';
  loadBlocks: (input: {
    templateId: string;
    slotId?: string;
    query?: string;
  }) => Promise<PromptBlock[]>;
};
```

---

## Provider mapping to current Engui data

## Character provider

### Source data
- `CharacterSummary`
- `traits`
- `gender`
- `name`

### Initial block outputs
- `appearance`
- partial `expression` only if derivable from traits later
- no guaranteed `outfit`

### Important decision
Current character data does not yet justify pretending we have a full outfit model.
For v1, outfit remains a direct slot field unless the user inserts a manual reusable block later.

### Suggested implementation behavior
Build concise appearance text from stable character traits in a deterministic order, for example:
- identity traits
- face traits
- hair traits
- body traits

Do not dump every trait blindly.
Use a stable allowlist.

---

## Vibe provider

### Source data
- `VibePresetSummary.baseDescription`
- `tags`
- `compatibleSceneTypes`

### Initial block outputs
- `style`
- `mood`
- `palette`
- `background`

### Important decision
Because current vibe data is mostly one freeform `baseDescription`, v1 should expose vibe blocks as reusable text fragments rather than pretending they are already fully structured.

This means a vibe selection may populate:
- one style field
- or multiple fields via explicit user choice later

But in v1, the library action should stay simple and insert text into the active slot.

---

## Pose provider

### Source data
- `PosePresetSummary.posePrompt`
- `PosePresetSummary.summary`
- `PosePresetSummary.characters[0]`

### Eligibility rule
Only show pose presets with `characterCount === 1` for this template.

### Initial block outputs
- `pose`
- `mainAction` when a useful phrase can be derived
- secondary body-language fragments

### Important decision
Do not attempt smart NLP decomposition in v1.
If `posePrompt` is already a good reusable phrase, use it directly.

---

## Why Scene Manager is not reused as the shell

Scene Manager currently assumes:
- linked source presets
- assembled prompt snapshot
- prompt rebuild flows
- editable generated prompt lifecycle

That is the wrong mental model for Prompt Constructor v1 because Prompt Constructor must enforce:
- no manual prompt editing
- one source of truth in slot state
- prompt as derived output only

Therefore, reuse data and ideas, not the shell.

---

## Rendering pipeline

## Input
- template definition
- prompt document state
- enabled constraints

## Output
- one plain prompt string

## Rendering steps
1. read template state
2. render section fragments in a stable order
3. omit empty fragments
4. normalize punctuation
5. join sections with line breaks
6. append enabled constraints last

## Normalization rules
- no doubled commas
- no `", ."`
- trim trailing punctuation inside slots before section assembly
- ensure each rendered section ends with a period

---

## Validation rules

V1 validation is intentionally lightweight.
Warnings only.

### Minimum rules
- warn if `title` is empty
- warn if all character fields are empty
- warn if `appearance` is empty
- warn if rendered prompt becomes too short to be useful
- warn if no constraints are enabled
- warn if the prompt contains unresolved placeholder text

### No hard validation on save except
- template id must exist
- document state must match template state shape

---

## Storage model

Create a separate persistence path for prompt documents.

### Proposed entity
`PromptDocumentRecord`

### Proposed API surface
- `GET /api/prompt-documents?templateId=single_character_scene_v1`
- `POST /api/prompt-documents`
- `GET /api/prompt-documents/:id`
- `PATCH /api/prompt-documents/:id`
- `DELETE /api/prompt-documents/:id` optional later

### Stored fields
- `id`
- `workspaceId`
- `title`
- `templateId`
- `templateVersion`
- `state`
- `enabledConstraintIds`
- `createdAt`
- `updatedAt`

### Important decision
Do not persist the rendered prompt as the primary stored artifact.
It can be recomputed client-side and server-side from state.

---

## Suggested component structure

```ts
PromptConstructorPage
└── PromptConstructorShell
    ├── RenderedPromptPane
    └── PromptConstructorSidebar
        ├── SlotsTab
        ├── LibraryTab
        └── ConstraintsTab
```

## Component responsibilities

### PromptConstructorPage
- load document by id or create a new one
- load template definition
- own page-level save/load actions

### PromptConstructorShell
- hold current template state
- derive rendered prompt
- derive validation warnings
- coordinate active slot selection

### RenderedPromptPane
- show final prompt
- show copy action
- show save status
- show warnings

### SlotsTab
- render template sections
- render slot controls
- update template state
- notify active slot selection

### LibraryTab
- load filtered blocks from providers
- insert selected block into active slot
- support replace and append modes

### ConstraintsTab
- toggle enabled constraints
- list defaults first
- search and filter snippets

---

## Suggested file layout

```text
src/lib/prompt-constructor/
  types.ts
  templateRegistry.ts
  constraints.ts
  normalization.ts
  providers/
    characters.ts
    vibes.ts
    poses.ts
  templates/
    singleCharacterSceneV1.ts

src/components/prompt-constructor/
  PromptConstructorShell.tsx
  RenderedPromptPane.tsx
  SlotsTab.tsx
  LibraryTab.tsx
  ConstraintsTab.tsx

src/app/api/prompt-documents/
  route.ts
src/app/api/prompt-documents/[id]/
  route.ts
```

This file layout keeps future templates additive.

---

## Slot UX details

### Active slot concept
The shell should keep `activeSlotId` in state.
That drives:
- Library filtering
- insertion target
- focus restoration

### Slot insertion behavior
For v1, support only:
- replace slot value
- append slot value with separator normalization

Do not support section-level insertion yet.

### Enum vs text
Even if some slots later become enums, v1 can safely keep most fields as text inputs with preset chips.
That is more flexible and reduces early migration cost.

---

## Constraints registry

### V1 default snippets

```ts
export const promptConstructorConstraints: ConstraintSnippet[] = [
  {
    id: 'consistent_anatomy',
    label: 'Consistent anatomy',
    content: 'consistent anatomy',
    applicableTemplateIds: ['single_character_scene_v1'],
    tags: ['anatomy'],
  },
  {
    id: 'no_extra_people',
    label: 'No extra people',
    content: 'no extra people',
    applicableTemplateIds: ['single_character_scene_v1'],
    tags: ['subject', 'clarity'],
  },
  {
    id: 'no_duplicated_limbs',
    label: 'No duplicated limbs',
    content: 'no duplicated limbs',
    applicableTemplateIds: ['single_character_scene_v1'],
    tags: ['anatomy'],
  },
  {
    id: 'clear_subject_focus',
    label: 'Clear subject focus',
    content: 'clear subject focus',
    applicableTemplateIds: ['single_character_scene_v1'],
    tags: ['composition', 'clarity'],
  },
];
```

### Important rule
Constraints are stored by id in the document and rendered by registry lookup.
This avoids prompt duplication in saved records.

---

## Template module contract

The single-character template module should contain:
- state factory
- section list
- slot definitions
- renderer
- validator

### Example contract

```ts
export const singleCharacterSceneV1: TemplateDefinition<SingleCharacterPromptState> = {
  id: 'single_character_scene_v1',
  version: 1,
  title: 'Single Character Scene',
  sections: [...],
  slots: [...],
  createInitialState: () => ({ ... }),
  render: (state, constraints) => ..., 
  validate: (state, constraints) => ..., 
};
```

This is the exact seam future templates should plug into.

---

## Save lifecycle

### New document
1. create empty state from template
2. apply default constraints
3. let user fill slots
4. save structured document

### Existing document
1. load stored state
2. load constraints
3. render derived prompt
4. edit slots
5. save structured state again

### Dirty tracking
Dirty state should compare:
- `title`
- template state
- enabled constraint ids

Do not compare rendered prompt directly.

---

## Minimal implementation phases

## Phase 1
- template module
- shell
- rendered prompt pane
- slots tab
- constraints tab
- prompt document API
- save/load

## Phase 2
- library tab
- character provider
- vibe provider
- pose provider
- search/filter in library

## Phase 3
- stronger normalization
- richer slot presets
- better validation
- template registry expansion

---

## Expansion path without rewrite

After v1 ships, the next templates should fit the same shell:
- `interaction_scene_v1`
- `character_object_scene_v1`
- `multi_panel_comic_v1`

The shell should not be rewritten.
Only these layers should expand:
- new template state type
- new template module
- new slot metadata
- optional new block categories
- optional new constraints

That is the core architectural success condition for this feature.

---

## Success criteria

V1 is successful when a desktop user can:
1. open Prompt Constructor
2. create or load a single-character prompt document
3. fill structured slots manually
4. insert reusable fragments from Character, Vibe, and Pose libraries
5. enable or disable constraints
6. see the rendered z-image turbo prompt update immediately
7. save the structured document
8. copy the final prompt for use elsewhere

---

## Final recommendation

Do not overfit the first implementation to only one template at the shell level.

Instead:
- keep the UI surface narrow
- keep the architecture template-capable
- keep the prompt read-only
- keep slot state as the only source of truth
- treat existing managers as reusable block providers

This is the cleanest path to a future Prompt Constructor system without another product rewrite.
