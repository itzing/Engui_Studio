# Scene Manager Spec

## Goal
Add a desktop-first Scene Manager for image generation so users can assemble reusable scenes from existing creative building blocks, preview the result quickly, and save scenes as reusable presets.

A scene preset combines:
- one optional pose preset
- one to three character presets
- one optional vibe preset
- scene-level instructions
- one assembled scene prompt snapshot

The Scene Manager should become the orchestration layer above Character Manager, Pose Manager, and Vibe Manager.

## Problem
Today users must manually combine character identity, pose geometry, vibe, and scene intent inside one freeform prompt.
That creates several problems:
- composition knowledge is scattered across multiple managers and ad hoc prompt edits
- combining multiple characters with a shared pose is error-prone
- there is no reusable preset for the full scene, only for individual parts
- prompt assembly is inconsistent across sessions and experiments
- quick prototyping of a whole scene requires too much manual rewriting
- it is hard to iterate on scene-level composition separately from character, pose, or vibe libraries

## Product outcome
The user should be able to:
1. create a new scene preset in a dedicated desktop manager
2. choose a pose preset, one to three character presets, and an optional vibe preset
3. add scene-level directions in plain language
4. build a scene prompt from those linked inputs
5. edit the generated prompt if needed
6. run a fast prototype preview from the manager
7. save the assembled scene as a reusable scene preset
8. reopen, edit, duplicate, delete, restore, and quickly reuse saved scenes later

## Scope

### In scope for desktop MVP
- Desktop Scene Manager UI
- Scene preset library
- Scene CRUD
- Search by name, summary, and tags
- Filter by character count (`single`, `duo`, `trio`)
- Selection of linked pose, character(s), and vibe presets
- Scene-level instruction field
- Deterministic template-based scene prompt assembly
- Editable assembled scene prompt
- Manual rebuild of assembled prompt from linked inputs
- Quick prototype preview generation inside the manager
- Optional latest preview thumbnail stored on the scene preset
- Soft delete / restore
- Duplicate scene preset
- Copy assembled prompt

### Explicitly out of scope for this desktop MVP
- Mobile Scene Manager UX
- LLM-first prompt assembly
- Full apply / integration into Create flows
- Automatic synchronization when linked character / pose / vibe presets change later
- Storyboards or multi-scene sequencing
- Video timeline editing
- Scene extraction from image
- Negative prompt generation
- More than three characters in MVP
- Advanced camera blocking or cinematography schema
- Version graph between a scene and its linked presets

## Strategic decisions

### 1. Desktop first
The first version should be designed for desktop only.
The manager will likely require a dense composition UI with:
- scene library
- linked preset pickers
- assembled prompt editor
- prototype preview

Mobile should be designed later based on real desktop usage, not guessed up front.

### 2. Template-first assembly
Desktop MVP should use deterministic template-based prompt assembly, not LLM-first assembly.

Why:
- easier to QA
- easier to debug
- more predictable prompt output
- better for early UX validation
- avoids mixing UX problems with prompt-helper variability

The system should still be architected so an LLM-based assembly or polish mode can be added later.

### 3. Scene as orchestration layer
Scene is a higher-level composition object.
It does not replace Character, Pose, or Vibe presets.
It links them and produces a combined result.

Responsibility split:
- Character = who
- Pose = body arrangement / physical relationship
- Vibe = atmosphere / stylistic tone
- Scene = complete composed setup for prompt generation and prototyping

### 4. Hybrid persistence
A scene preset should persist:
- links to the chosen source presets
- scene-level instructions
- one generated scene prompt snapshot

This is important because:
- the scene remains connected to reusable source presets
- the user does not lose the already assembled result
- later changes in linked presets do not silently rewrite old scene prompts
- the user can explicitly choose to rebuild when desired

## Core concepts

### Scene preset
A scene preset is the reusable saved result of composition work.
It stores the selected source presets plus one assembled prompt snapshot.

### Character bindings
A scene does not just store a list of characters.
It stores character slots with explicit ordering and optional role labels.
This matters for pose matching and for later scene rendering.

### Assembled scene prompt
The generated scene prompt is a prompt-sized textual representation of the selected scene components.
In MVP it is built deterministically from a renderer, not by an LLM.

### Prototype preview
Prototype preview is a quick image-generation loop used from inside Scene Manager.
Its job is fast validation of scene composition, not full create-flow replacement.

## Main entities

### ScenePreset
```ts
interface ScenePreset {
  id: string;
  workspaceId: string;
  name: string;
  summary: string;
  characterCount: 1 | 2 | 3;
  tags: string[];

  posePresetId: string | null;
  vibePresetId: string | null;
  characterBindings: SceneCharacterBinding[];

  sceneInstructions: string;
  assemblyMode: 'template';
  generatedScenePrompt: string;

  latestPreviewImageUrl?: string | null;
  latestPreviewJobId?: string | null;

  status: 'active' | 'trash';
  createdAt: string;
  updatedAt: string;
}
```

### SceneCharacterBinding
```ts
interface SceneCharacterBinding {
  slot: number;
  roleLabel?: string | null;
  characterPresetId: string | null;
  overrideInstructions?: string | null;
}
```

### SceneAssemblyInput
```ts
interface SceneAssemblyInput {
  sceneName: string;
  sceneSummary: string;
  characterCount: 1 | 2 | 3;
  sceneInstructions: string;

  pose: {
    id: string;
    name: string;
    posePrompt: string;
    summary: string;
    characterCount: 1 | 2 | 3;
  } | null;

  vibe: {
    id: string;
    name: string;
    baseDescription: string;
    tags: string[];
  } | null;

  characters: Array<{
    slot: number;
    roleLabel?: string | null;
    characterId: string | null;
    resolvedCharacterPrompt: string;
    overrideInstructions?: string | null;
  }>;
}
```

### SceneAssemblyResult
```ts
interface SceneAssemblyResult {
  prompt: string;
  mode: 'template';
  warnings: string[];
}
```

## Functional requirements

### 1. Scene library
The product must provide a Scene Manager library similar in spirit to the other managers.

Required capabilities:
- list saved scene presets
- search by name / summary / tags
- filter by `single`, `duo`, `trio`
- create a new scene preset
- edit an existing scene preset
- duplicate a scene preset
- move a scene preset to trash
- restore a scene preset from trash
- copy the assembled prompt from a scene preset

Each list item should show:
- scene name
- short summary
- character count badge
- tags
- linked source badges when useful (`pose`, `vibe`)
- latest preview thumbnail if available
- updated timestamp

### 2. Character count model
Desktop MVP should support only these scene sizes:
- `1` character
- `2` characters
- `3` characters

Rules:
- each scene preset must declare one character count
- each scene preset must expose exactly that many character slots
- each slot should preserve stable ordering (`slot 0`, `slot 1`, `slot 2`)
- pose selection is optional, but if a pose is selected, its `characterCount` must match the scene `characterCount`
- vibe selection is optional

### 3. Character bindings
Character binding is a core part of the scene model.

Each character slot must support:
- selecting an existing character preset
- optional role label (`lead`, `partner`, `left`, `right`, etc.)
- optional scene-specific override instructions for that slot

Recommended binding behavior:
- slots are explicit and visible in the editor
- slot labels are editable but not required
- the system should preserve slot order across save/load
- slot order should be used during prompt assembly

### 4. Scene composition inputs
The user must be able to compose a scene from these inputs:
- scene name
- scene summary
- scene tags
- character count
- one optional pose preset
- one to three character bindings
- one optional vibe preset
- scene-level instructions

Scene-level instructions should represent the part that does not naturally belong inside Character, Pose, or Vibe.
Examples:
- interaction intent
- staging note
- background or context note
- framing hints in plain language
- small compositional instructions that are scene-specific

### 5. Template-based prompt assembly
Every scene preset must have a `generatedScenePrompt`.

For MVP, prompt assembly must be deterministic.
It should not depend on an LLM.

Renderer goals:
- readable by humans
- consistent across rebuilds
- easy to inspect and debug
- suitable for direct use as a reusable scene prompt block
- structured enough to combine character identity, pose geometry, and vibe cleanly

The renderer should build the prompt in a fixed logical order:
1. scene-level directions
2. character blocks
3. pose block
4. vibe block
5. optional final composition note

The exact final string format can evolve, but it must remain deterministic for the same input set.

### 6. Generated prompt lifecycle
The assembled scene prompt should be generated, but still user-editable.

Expected behavior:
- user can build prompt from current linked inputs
- user can manually edit the generated prompt afterward
- user can explicitly rebuild from linked inputs later
- rebuild should warn before overwriting manual prompt edits
- saved scene presets persist the latest generated or manually refined prompt snapshot

This mirrors the practical pattern used in other managers:
- structured inputs stay primary
- rendered prompt stays useful and editable

### 7. Template renderer guidelines
The template renderer should follow these rules:

#### Character rendering
Character blocks should:
- respect slot order
- include role labels when present
- use the character preset's resolved prompt representation
- append slot-level override instructions when present
- avoid unnecessary repeated boilerplate

#### Pose rendering
Pose block should:
- use the selected pose preset's `posePrompt`
- preserve pose geometry as-is as much as possible
- remain optional when no pose is selected

#### Vibe rendering
Vibe block should:
- use the selected vibe preset's `baseDescription`
- contribute atmosphere and stylistic guidance
- remain optional when no vibe is selected

#### Scene instruction rendering
Scene-level instructions should:
- appear near the top of the assembled prompt
- act as the director note for the overall composition
- remain plain-language editable text

#### Deduplication
MVP should not attempt aggressive semantic deduplication.
Simple cleanup is enough:
- trim whitespace
- avoid empty sections
- avoid exact duplicate blank lines

### 8. Save rules and validation
A scene preset should be savable only when it has enough information to be meaningful.

Minimum save requirements for MVP:
- `name`
- `characterCount`
- all character slots exist
- at least one selected character preset across the slots
- non-empty `generatedScenePrompt`

Additional validation rules:
- selected pose, if any, must match scene `characterCount`
- scene cannot save if the prompt is empty
- deleted linked presets should be shown as broken references when reopening a scene
- broken references should not auto-delete the scene preset

### 9. Prototype preview
The Scene Manager must support quick visual prototyping.

Prototype preview goals:
- validate whether the assembled scene is promising
- provide a fast loop from composition to image result
- avoid forcing the user to leave the manager for early experimentation

Recommended MVP behavior:
- user clicks `Prototype`
- manager runs a lightweight image generation request using the current assembled scene prompt
- manager shows progress and the latest resulting preview image
- latest preview can optionally become the scene card thumbnail

Prototype preview is not meant to replace the full Create flow.
It is a fast validation lane.

### 10. Reuse behavior
Direct Create-flow integration is out of scope for this MVP, but the manager should still support practical reuse.

Required MVP reuse actions:
- copy assembled prompt to clipboard
- reopen and edit an existing scene
- duplicate an existing scene as a starting point

Future reuse actions may include:
- apply to current Create prompt
- open in Create with linked scene payload
- decompose scene back into pose / vibe / character selections

### 11. Trash behavior
Scene presets should use the same soft-delete pattern as other managers.

Required behavior:
- active scenes and trashed scenes are separated
- user can restore trashed scenes
- trashed scenes are read-only until restored
- delete in MVP means soft delete, not permanent delete

## Desktop UX specification

### A. Entry point
Recommended desktop entry point:
- dedicated `Scene Manager` button near Character / Vibe / Pose manager controls

The Scene Manager should open in a dedicated full-canvas desktop dialog, similar in spirit to the larger managers.

### B. Desktop layout
Recommended desktop layout:
- left column: scene library
- center column: scene editor
- right column or lower section: prototype preview

If needed for implementation simplicity, preview may initially live as a right-side card stack or a tab inside the editor panel.
The important part is that prompt assembly and prototype feedback stay visible from inside the manager.

### C. Library column
Required library sections:
- search input
- character count filters: `All / Single / Duo / Trio`
- active / trash switch
- create button

Each list item should show:
- name
- summary
- count badge
- small tag strip
- latest preview image if available
- source indicators if useful

### D. Editor column
The editor should expose:
- scene name
- scene summary
- scene tags
- character count selector
- character binding slots
- pose picker
- vibe picker
- scene instructions
- assembled prompt editor
- build / rebuild controls
- save button

Recommended editor grouping:
1. Scene metadata
2. Character bindings
3. Pose and vibe links
4. Scene instructions
5. Assembled prompt

### E. Character binding UI
Each character slot should show:
- slot title (`Character 1`, `Character 2`, `Character 3`)
- optional role label input
- selected character preset summary
- action to choose or replace character preset
- optional override instructions textarea

The UI should make it obvious which selected characters belong to which scene slots.

### F. Pose and vibe pickers
Pose and vibe selection should use manager-style pickers, not raw ID inputs.

Required pose picker behavior:
- show current linked pose
- allow replace / clear
- prevent selecting a pose with mismatched character count

Required vibe picker behavior:
- show current linked vibe
- allow replace / clear

### G. Assembled prompt UX
The assembled prompt area should support:
- `Build prompt`
- `Rebuild from linked presets`
- manual editing
- copy to clipboard
- dirty-state handling

The prompt should be displayed in a large multiline editor.
This is one of the main outputs of the manager, not a hidden field.

### H. Prototype preview UX
Preview area should support:
- preview placeholder when nothing has been generated yet
- prototype action button
- loading state
- display of most recent preview image
- retry action
- optional quick note showing which prompt snapshot produced the preview

### I. Empty states
Required empty states:
- no scenes yet
- no selected scene
- no preview yet
- broken linked preset reference

Recommended copy pattern:
- explain what the user can do next
- keep empty states actionable
- do not overwhelm with implementation detail

### J. Unsaved changes
Scene Manager should protect the user from losing in-progress edits.

Recommended behavior:
- unsaved change indicator in the header or action bar
- confirmation when switching scenes with unsaved edits
- confirmation when closing the manager with unsaved edits
- confirmation when rebuilding prompt over manual prompt edits

## Template assembly specification

### Input sources
The template renderer should consume:
- scene metadata
- scene instructions
- resolved character prompt blocks
- optional pose prompt
- optional vibe description

### Character prompt resolution
Scene Manager should not invent character text itself.
It should rely on the existing character-preset representation used elsewhere in the product.

In implementation terms, Scene Manager should consume a resolved character prompt block for each selected character preset.
How that character block is derived internally can be handled by Character Manager infrastructure.

### Suggested prompt structure
A reasonable MVP prompt structure is:
1. top-level scene direction
2. ordered character descriptions
3. pose / interaction block
4. vibe / atmosphere block
5. optional final synthesis line

This can be rendered as multiline text or as a single cleaned prompt string, as long as the output remains deterministic.

### Future LLM mode
Future versions may add:
- `assemblyMode: 'llm'`
- `Polish with AI`
- `Rewrite scene prompt`

That future LLM path should be additive.
It should not replace the deterministic template path for MVP.

## Data and API requirements
This document is not the final API contract, but the following backend surface is expected.

### Scene preset CRUD
- `GET /api/scenes`
- `POST /api/scenes`
- `PUT /api/scenes/[id]`
- `PATCH /api/scenes/[id]` for soft delete / restore

### Assembly helpers
- `POST /api/scenes/assemble`
  - accepts a full scene assembly input
  - returns deterministic assembled prompt + warnings

### Prototype preview
- `POST /api/scenes/prototype`
  - accepts current scene state or scene preset id
  - returns job / preview metadata

### Picker data
Scene Manager will also need lookup surfaces or reuse of existing manager APIs for:
- characters
- poses
- vibes

## Recommended implementation phases

### Phase 1: desktop template-first Scene Manager
- scene data model and persistence
- desktop library and editor
- character / pose / vibe linking
- template assembly
- editable prompt snapshot
- prototype preview
- save / duplicate / trash / restore

### Phase 2: desktop refinement
- stronger preview UX
- better scene thumbnails
- broken-reference handling polish
- copy / compare / rebuild UX improvements

### Phase 3: optional LLM enhancement
- AI prompt polish
- LLM assembly as optional alternative mode
- compare template result vs AI result

### Phase 4: mobile product design
- derive mobile flows from real desktop usage
- simplify scene editing for smaller screens
- avoid blindly copying desktop layout

## Non-goals for the current spec
This spec does not define:
- final mobile UX
- full Create integration contract
- prompt-helper prompting strategy for future LLM assembly
- final visual styling details
- low-level database migration details

## Success criteria
Desktop Scene Manager MVP is successful when a user can:
1. open Scene Manager on desktop
2. create a one-, two-, or three-character scene
3. select existing character, pose, and vibe presets
4. add scene instructions
5. build a deterministic scene prompt
6. edit that prompt manually
7. run a quick prototype preview
8. save the scene preset
9. reopen it later and continue iterating without rebuilding everything from scratch
