# Pose Manager Spec

## Goal
Add a Pose Manager for image generation, similar in product shape to Vibe Manager, so users can:
- maintain reusable pose presets
- extract pose descriptions from reference images
- support `single`, `duo`, and `trio` character compositions
- inject a saved pose into the active Create prompt without rewriting pose instructions manually each time

This feature is primarily aimed at image workflows, with special usefulness for `z-image`, where long detailed pose descriptions are valuable.

## Problem
Today pose intent lives inside freeform prompts.
That creates several problems:
- users repeat the same pose instructions across prompts
- pose descriptions are hard to standardize
- multi-character relationships are tedious to rewrite
- extracted pose knowledge from reference images is lost after one use
- there is no reusable pose library comparable to Vibe Manager

## Product outcome
The user should be able to:
1. upload an image into a pose extractor
2. receive a structured pose result plus a ready-to-inject pose prompt
3. save that result as a reusable pose preset
4. browse/search/filter pose presets by character count and tags
5. apply a selected pose to the current Create prompt in one action

## Scope
### In scope
- Pose preset library
- Pose extraction from image
- Support for `1`, `2`, and `3` characters
- Structured pose schema
- Generated pose prompt text for injection
- Manual creation/editing of pose presets
- Apply pose to Create prompt
- Desktop full manager UI
- Mobile pose picker/apply UX only

### Out of scope
- camera framing / shot composition metadata
- automatic skeleton detection or keypoint editing UI
- pose blending / pose interpolation
- negative-prompt generation
- video-specific pose timeline editing
- more than three characters in MVP
- full scene blocking beyond pose relationships

## Core concepts
A pose preset is not just text.
It has two representations:
1. **structured pose data** for editing, filtering, and future automation
2. **rendered pose prompt text** for immediate use in prompt injection

This keeps the feature flexible:
- humans can read and edit the prompt text
- the app can reason about the structured fields
- different models may later use different renderers from the same source data

## Main entities

### PosePreset
```ts
interface PosePreset {
  id: string;
  workspaceId: string;
  name: string;
  characterCount: 1 | 2 | 3;
  summary: string;
  posePrompt: string;
  tags: string[];
  source: 'manual' | 'extracted';
  sourceImageUrl?: string | null;
  modelHint?: string | null;
  characters: PoseCharacter[];
  relationship?: PoseRelationship | null;
  createdAt: string;
  updatedAt: string;
}
```

### PoseCharacter
```ts
interface PoseCharacter {
  index: number;
  label?: string | null;
  orientation: string;
  head: string;
  gaze: string;
  torso: string;
  armsHands: string;
  legsStance: string;
  expression?: string | null;
}
```

### PoseRelationship
```ts
interface PoseRelationship {
  spatialLayout: string;
  interaction: string;
  contact: string;
  symmetry: string;
}
```

### PoseExtractionResult
```ts
interface PoseExtractionResult {
  characterCount: 1 | 2 | 3;
  summary: string;
  posePrompt: string;
  tags: string[];
  characters: PoseCharacter[];
  relationship?: PoseRelationship | null;
}
```

## Functional requirements

### 1. Pose library
The product must provide a Pose Manager library similar in spirit to Vibe Manager.

Required capabilities:
- list saved pose presets
- search by name / summary / tags
- filter by `single`, `duo`, `trio`
- create a new pose preset manually
- edit an existing preset
- delete a preset
- duplicate a preset
- apply a preset to the current Create flow

### 2. Character count model
MVP supports only these composition sizes:
- `1` character
- `2` characters
- `3` characters

Rules:
- `single` presets must contain exactly 1 character block
- `duo` presets must contain exactly 2 character blocks and a relationship block
- `trio` presets must contain exactly 3 character blocks and a relationship block
- extractor must classify the image into one of these three counts or fail gracefully

### 3. Pose extraction
The user must be able to upload or select an image and run pose extraction.

Extractor output must include:
- detected character count
- summary
- per-character pose description
- relationship description for multi-character poses
- ready-to-inject `posePrompt`

The extractor should focus on:
- body orientation
- head direction
- gaze direction
- arm and hand placement
- leg and stance description
- expression if visible and useful
- relative arrangement between characters
- contact or non-contact between characters
- directionality of interaction

The extractor should not focus on:
- detailed clothing description unless required to understand pose
- environment unless required to explain pose
- shot framing

### 4. Prompt rendering
Every pose preset must have a generated `posePrompt`.

This text should:
- be readable by humans
- be suitable for direct injection into image prompts
- preserve detailed pose geometry
- be especially rich for `z-image`

Rendering rules:
- `single` pose text focuses on one body configuration
- `duo` pose text emphasizes both individual poses and relationship geometry
- `trio` pose text emphasizes arrangement and interactions among all three characters

### 5. Apply flow
A pose preset can be applied from Pose Manager into Create.

Expected behavior:
- user selects a pose preset
- user presses `Apply to prompt`
- the preset's `posePrompt` is injected into the active image prompt

Recommended MVP behavior:
- append pose text into the current prompt with predictable spacing
- avoid destructive overwrite by default

Optional future modes, not required in MVP:
- replace existing pose block
- insert into dedicated prompt section
- model-specific formatting modes

### 6. Manual authoring
The user must be able to create pose presets without extraction.

Manual editing UI should expose:
- name
- character count
- summary
- tags
- per-character pose fields
- relationship fields when character count > 1
- generated or manually editable `posePrompt`

Recommended behavior:
- structured fields are primary
- `posePrompt` is auto-generated from structured data
- user may optionally refine `posePrompt` before saving

### 7. Review before save
Extraction should not save automatically.

Expected flow:
1. user uploads image
2. system extracts pose
3. user reviews the result
4. user edits if needed
5. user saves as preset

This matches the Vibe Manager style and avoids polluting the library with low-quality extractions.

## UX specification

### A. Desktop Pose Manager entry points
Recommended desktop entry points:
- dedicated `Pose Manager` button near Vibe Manager / tools area
- `Extract Pose` action near image reference tools
- `Apply Pose` action from Create prompt area

### B. Desktop Pose library screen
Required sections:
- search input
- character count filters: `All / Single / Duo / Trio`
- preset grid or list
- create button
- extract button

Each list item should show:
- name
- character count badge
- short summary
- tags
- source badge: `manual` or `extracted`

Primary item actions:
- Apply
- Edit
- Duplicate
- Delete

### C. Desktop pose extraction flow
Recommended desktop modal or panel flow:
1. select/upload image
2. run extraction
3. show loading state
4. show review form with structured result
5. allow edits
6. save as preset

Review form should include:
- character count selector
- summary
- tags
- character blocks
- relationship block for multi-character poses
- generated pose prompt preview
- save button

### D. Create integration
For image creation, the user should be able to:
- open Pose Manager on desktop
- pick a preset
- apply it to prompt
- continue editing prompt normally

On mobile, Create integration should be limited to:
- open a lightweight pose picker
- search/filter/select an existing pose preset
- apply it to prompt

Mobile must not include the full manager editor, extraction workflow, or full preset authoring UI in MVP.

Recommended UX label examples:
- `Apply Pose`
- `Extract Pose`
- `Save as Pose`

## Suggested extraction prompt behavior
The extractor should aim for concise but high-value structure.

### Single character extraction focus
- whether the body faces front, side, back, or three-quarter view
- head tilt and direction
- gaze direction
- arm placement and hand activity
- leg stance, balance, seated or standing posture
- notable dynamic action or tension

### Duo extraction focus
- individual pose for character A and B
- who is left/right or front/behind
- whether they face each other, align together, or oppose each other
- touch/contact details
- interaction intent: embrace, support, confrontation, guiding, leaning, etc.

### Trio extraction focus
- arrangement of all three characters
- grouping structure, for example center-focused, triangular, side-by-side
- per-character pose description
- interaction and contact topology
- asymmetry or mirrored composition if relevant

## Prompt rendering guidance
Rendered `posePrompt` should be optimized for reuse, not prose beauty.

Example style goals:
- explicit and visual
- low ambiguity
- strong relational wording
- reusable across prompts

### Example single output style
```text
one character standing in a three-quarter body angle, head slightly tilted down, eyes looking to the left, one arm bent with hand near the chest, the other arm relaxed at the side, weight shifted onto one leg, relaxed but alert posture
```

### Example duo output style
```text
two characters facing each other at close distance, character one standing slightly forward with torso angled toward character two, right hand lifted toward the other character's shoulder, character two leaning in with head turned toward character one, their bodies nearly touching, intimate asymmetrical pose
```

### Example trio output style
```text
three characters in a loose triangular arrangement, center character facing forward with squared posture, left character turned inward with one hand extended toward the center, right character leaning slightly toward the group with crossed legs and head turned toward the center, connected group interaction with asymmetrical balance
```

## Data persistence
Pose presets should be persisted as first-class library entities, not only in localStorage.

Recommended storage layer:
- server-backed persistence, similar to other reusable library entities
- scoped by workspace if that matches current Engui patterns

Suggested fields:
- id
- workspaceId
- name
- characterCount
- summary
- posePrompt
- tags
- source
- sourceImageUrl
- modelHint
- charactersJson
- relationshipJson
- createdAt
- updatedAt

## API suggestions
These endpoint names are suggestions, not mandates.

### Pose presets
- `GET /api/poses`
- `POST /api/poses`
- `PATCH /api/poses/[id]`
- `DELETE /api/poses/[id]`
- `POST /api/poses/[id]/duplicate`

### Pose extraction
- `POST /api/poses/extract`

Expected extract request:
```json
{
  "imageUrl": "...",
  "workspaceId": "..."
}
```

Expected extract response:
```json
{
  "success": true,
  "result": {
    "characterCount": 2,
    "summary": "Close face-to-face duo pose",
    "posePrompt": "two characters facing each other ...",
    "tags": ["duo", "close", "intimate"],
    "characters": [...],
    "relationship": {
      "spatialLayout": "character one on the left, character two on the right, close distance",
      "interaction": "facing each other with mutual attention",
      "contact": "light upper-body contact",
      "symmetry": "asymmetrical"
    }
  }
}
```

## Validation rules
- `name` required
- `characterCount` required and limited to `1 | 2 | 3`
- `characters.length` must equal `characterCount`
- `summary` required
- `posePrompt` required before save
- `relationship` required when `characterCount > 1`
- empty character fields should fail validation if they would make the preset useless

## Failure and fallback behavior
### Extraction failure
If extractor cannot confidently determine pose:
- return a clear error state
- allow retry
- do not save anything automatically

### Ambiguous character count
If the image seems outside supported scope:
- return failure with reason like `unsupported_character_count`
- optionally allow manual override to `1`, `2`, or `3`

### Weak extraction quality
If extracted text is too vague:
- user can edit before save
- save is still allowed after manual correction

## MVP checklist
### Must have
- desktop pose library
- single/duo/trio support
- extract from image
- structured pose schema
- generated pose prompt
- desktop save/edit/delete/apply flows
- Create prompt injection
- mobile picker/apply flow for existing presets only

### Nice to have if cheap
- duplicate preset
- tags
- source image preview in editor
- model hint such as `best for z-image`

### Not for MVP
- framing
- pose blending
- batch extraction
- timeline/video pose management
- more than 3 characters
- advanced semantic search

## Recommended implementation order
1. data model and persistence
2. basic Pose Manager library UI
3. manual create/edit flow
4. pose extraction endpoint and review flow
5. apply-to-prompt integration in Create
6. desktop polish plus mobile picker/apply QA

## Open product decisions
These are still worth confirming before implementation:
1. should pose presets be workspace-scoped, global, or both?
2. should `Apply Pose` always append, or should it support replace mode from day one?
3. should pose extraction use the same vision stack as Vibe extraction, or a separate tuned prompt/path?
4. should saved poses support favorites or folders in MVP, or wait?

## Platform split recommendation
Desktop gets the full Pose Manager experience:
- library
- create/edit
- extraction
- review-before-save
- apply

Mobile gets only the lightweight consumption flow:
- browse/search/filter existing pose presets as needed
- choose a pose
- apply it to Create

This keeps the high-complexity authoring workflow on desktop while preserving the practical mobile use case.

## Recommendation
Build Pose Manager as a sibling concept to Vibe Manager, not as a minor prompt helper.
The main value is reusable structured pose knowledge, especially for detailed multi-character compositions.
The extraction flow should prioritize relationship geometry, because that is the hardest part for users to rewrite repeatedly and the highest-value part to preserve.
