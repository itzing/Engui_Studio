# Character Manager V1 Specification

## 1. Overview

Character Manager is a structured system for defining and editing a character as a concrete named entity.

In v1, the system focuses on:
- raw character definition
- versioned trait snapshots
- persisted editor state per character
- assistant-driven draft editing
- import-based character creation

Out of scope for this spec version:
- detailed preview generation rules
- reference package mechanics
- trash management details
- AI-generated version summaries
- assistant confirmation/review modal before patch apply

---

## 2. Core Principles

### 2.1 Character = concrete named entity
A character is always a concrete named entity.

Not in v1:
- unnamed reusable templates

Supported in v1:
- create a new character from an existing version of another character

### 2.2 Raw morphology only
Character traits store intrinsic appearance traits only.

Do not store in character traits:
- styling
- makeup
- clothing
- pose
- expression
- lighting
- scene

### 2.3 Trait values
Trait values are stored as free-form normalized text.

V1 does not use a dictionary/enums database for trait values.
Normalization is delegated to the model and application logic.

### 2.4 Trait schema source of truth
Trait keys, group membership, labels, and volatility metadata are code-first in v1.

The design should allow future migration to a database-driven schema, but v1 source of truth is static schema/config in code.

---

## 3. Trait Model

### 3.1 Canonical persisted trait shape
Traits are persisted as a flat object map.

Example:

```json
{
  "eye_shape": "almond shaped",
  "hip_width": "wide",
  "body_build": "athletic"
}
```

Other shapes may be derived at runtime for assistant/export/import purposes.

### 3.2 Only existing traits are stored
Snapshots store only traits that currently exist.
Empty traits are not stored.
Missing traits are not compared.

### 3.3 Confirmed trait volatility mapping

```json
[
  { "key": "name", "volatility": "core" },
  { "key": "gender", "volatility": "core" },
  { "key": "ethnicity", "volatility": "core" },
  { "key": "skin_tone", "volatility": "core" },
  { "key": "undertone", "volatility": "core" },

  { "key": "face_shape", "volatility": "core" },
  { "key": "eye_color", "volatility": "core" },
  { "key": "eye_shape", "volatility": "stable" },
  { "key": "eyebrow_shape", "volatility": "stable" },
  { "key": "eyebrow_density", "volatility": "flexible" },
  { "key": "nose_shape", "volatility": "core" },
  { "key": "lip_color_natural", "volatility": "core" },
  { "key": "lip_shape", "volatility": "stable" },
  { "key": "lip_fullness", "volatility": "stable" },

  { "key": "hair_color", "volatility": "core" },
  { "key": "hair_texture", "volatility": "core" },
  { "key": "hair_length_base", "volatility": "stable" },

  { "key": "body_build", "volatility": "stable" },
  { "key": "body_proportions", "volatility": "stable" },
  { "key": "shoulder_width", "volatility": "stable" },
  { "key": "waist_definition", "volatility": "flexible" },
  { "key": "hip_width", "volatility": "stable" },
  { "key": "leg_length", "volatility": "stable" },
  { "key": "neck_length", "volatility": "flexible" },

  { "key": "pelvis_structure", "volatility": "stable" },
  { "key": "pelvis_to_torso_ratio", "volatility": "stable" },
  { "key": "lower_abdomen_shape", "volatility": "flexible" },
  { "key": "glute_shape", "volatility": "stable" },
  { "key": "glute_position", "volatility": "stable" },
  { "key": "glute_definition", "volatility": "flexible" },
  { "key": "leg_structure", "volatility": "stable" },

  { "key": "posture", "volatility": "flexible" },
  { "key": "neck_alignment", "volatility": "flexible" },
  { "key": "hip_alignment", "volatility": "flexible" },
  { "key": "knee_alignment", "volatility": "flexible" }
]
```

---

## 4. Locking Model

There are two lock systems in v1.

### 4.1 Volatility-level lock
The editor may lock any volatility class:
- core
- stable
- flexible

If a volatility class is locked, assistant must not modify traits in that class.

### 4.2 UI lock
UI lock determines whether a specific trait is sent to the assistant for editing.

### 4.3 Group lock
Trait groups such as head/body can also be locked.

### 4.4 Enforcement model
Locks are enforced before assistant prompt assembly.
The assistant receives only the editable subset of current traits.

If assistant still returns changes touching locked/excluded traits, those changes are dropped and the UI shows a lightweight note that some locked traits were skipped.

---

## 5. Persisted Entities

### 5.1 Character
`Character` must contain:
- `id`
- `name`
- `gender`
- current saved `traits`
- current saved `editorState`
- `currentVersionId`
- `createdAt`
- `updatedAt`
- `deletedAt`
- preview status summary

Notes:
- `Character` is intentionally denormalized for practical UI usage.
- `name` and `gender` are top-level fields even though traits may also contain overlapping data.

### 5.2 CharacterVersion
`CharacterVersion` must contain:
- `id`
- `characterId`
- `traitsSnapshot`
- `editorStateSnapshot`
- `versionNumber`
- `changeSummary`
- `createdAt`

Not included in v1:
- authorship metadata
- parentVersionId
- branching model

### 5.3 Editor state
Persisted editor state lives:
- as current live state on `Character`
- as snapshot on each `CharacterVersion`

`editorState` includes:
- `groupLocks`
- `uiTraitLocks`
- `lockedVolatilityLevels`
- expanded/collapsed trait groups
- selected preview tab/view mode

`editorState` does not include:
- last active version id
- unsaved draft trait edits

---

## 6. Draft and Save Model

### 6.1 Unsaved edits
Unsaved trait edits live only in a transient in-memory draft.

### 6.2 Canonical saved state
`Character` stores only saved canonical current state.

### 6.3 Save semantics
Save is enabled only when traits changed.

On Save:
- write current draft traits into `Character`
- write current editor state into `Character`
- create a new `CharacterVersion`
- snapshot both `traits` and `editorState` into the version

### 6.4 Version creation rule
Create a new `CharacterVersion` only if trait data changed.
Editor-state-only changes do not create a new version.

### 6.5 Editor-state persistence rule
Editor state is persisted only when bundled with a trait-changing Save.
If only editor state changed and traits did not change, nothing is persisted in v1.

### 6.6 Cancel behavior
Cancel/close may safely discard the transient draft.

---

## 7. Version History and Change Summary

### 7.1 Version model
Versions are immutable ordered snapshots.

### 7.2 changeSummary type
In v1, `changeSummary` is plain free text only.

### 7.3 changeSummary authoring
User may provide a custom summary.
If omitted, the system auto-generates a deterministic plain-text summary from the trait diff.

### 7.4 Fallback summary format
Deterministic fallback format is compact diff-style text.

Example:

```text
eye_shape: round → almond; hip_width: narrow → wide
```

### 7.5 Future direction
AI-generated summaries are desirable later, but out of scope for v1 because they require async/background processing.

---

## 8. Unknown and Legacy Traits

If stored character data contains trait keys no longer present in the code-defined schema:
- keep them in persisted data
- show them in a separate unsupported/legacy section
- do not silently drop them

---

## 9. Character Creation Paths

Supported in v1:
1. manual create new character
2. create from import text parse flow
3. create from cloning an existing version into a new character

Not supported in v1:
- create from preview/reference package

### 9.1 Manual create flow
Opening "new character" creates nothing persisted.
Persistence starts only on the first successful Save.

Minimum requirement for first successful Save:
- `name` only

### 9.2 Import create flow
If parser returns `name = null`, user must be blocked from confirmation until a name is supplied.

After import confirmation:
- create `Character`
- create initial `CharacterVersion`

### 9.3 Clone from version flow
When cloning an existing version into a new character, copy only:
- `traitsSnapshot`
- `editorStateSnapshot`

Do not copy:
- preview status summary
- preview sets
- source version provenance metadata

---

## 10. Delete Model

Normal delete in v1 is soft delete.
Use `deletedAt` on `Character`.

Permanent delete / trash management is out of scope for this spec version and should be designed separately later.

---

## 11. Assistant Edit Flow

### 11.1 Assistant context
Assistant receives only the editable subset of current traits.

### 11.2 Assistant contract
V1 assistant response contract:

```json
{
  "summary": "",
  "action": "apply_patch",
  "changes": [
    {
      "key": "body_build",
      "old_value": "slim",
      "new_value": "athletic"
    }
  ]
}
```

`requires_user_confirmation` is not part of the v1 contract.

### 11.3 Assistant patch application
In v1, assistant patch auto-applies directly to the transient draft.

### 11.4 Visibility of assistant changes
Assistant-applied draft changes must be highlighted in the editor until the next Save or Cancel.

### 11.5 Locked trait handling
If assistant patch tries to modify a locked/excluded trait:
- drop that change
- show a lightweight note such as: `Some locked traits were skipped.`
- do not fail the whole patch

### 11.6 Future direction
A confirmation/review modal for assistant patches may be added later if UX proves it is needed.

---

## 12. Manual Trait Editing

Manual trait editing is not free inline editing.
Use an edit icon and a modal for trait changes.

Unknown/unsupported values do not need special first-class treatment beyond legacy handling. If a trait is not in the stored data, it is absent from both storage and normal UI.

---

## 13. Preview and Reference Scope

For v1, preview/reference remain only at base-foundation level.
Detailed generation rules, package semantics, and downstream reference usage will be specified later.

What is already fixed:
- `Character` root entity may store preview status summary
- preview-related editor tab/view mode may exist in `editorState`

What is not fixed yet:
- preview generation lifecycle
- preview persistence model details
- reference package semantics
- consistent character mechanics

---

## 14. Recommended UI Entry Point for Character Manager

### Recommendation
Add a dedicated **Character Manager icon/button in the main app navigation/sidebar**, not buried inside a single generation form.

### Why this is the right placement
Character Manager is a cross-cutting definition system, not a one-off helper tied to one generation surface.
It should feel like a first-class workspace area, similar to:
- Gallery
- Jobs
- Settings
- Workspace Media

### V1 preferred placement
Primary recommendation:
- add a sidebar/nav item labeled **Characters** with a character/person icon

Secondary shortcut, optional later:
- add contextual quick-open buttons inside generation flows where character references will matter

### Why not only a form-level icon
If the only entry is inside one generation form, users will interpret Character Manager as a prompt helper accessory rather than a reusable system-level asset manager.

### V1 UX goal
The user should be able to think:
- first define/manage characters in **Characters**
- then use them elsewhere later

That mental model is cleaner and scales better.

---

## 15. Summary

Character Manager v1 is a code-schema-driven, versioned character-definition system with:
- flat trait maps
- transient editing drafts
- immutable saved versions
- persisted editor-state snapshots
- assistant-driven draft patching
- soft delete
- import/manual/clone creation paths

It intentionally defers deeper preview/reference mechanics and advanced assistant review workflows to later specification rounds.
